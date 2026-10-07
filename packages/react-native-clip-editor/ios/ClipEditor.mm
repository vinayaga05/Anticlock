#import "ClipEditor.h"

#import <AVFoundation/AVFoundation.h>
#import <UIKit/UIKit.h>

#pragma clang diagnostic push
// Synchronous track loading is intentional: everything runs on a private
// serial queue, and the async loaders would complicate the export pipeline.
#pragma clang diagnostic ignored "-Wdeprecated-declarations"

static const CGFloat kMaxShortSide = 1080.0;

static NSURL *_Nullable CEURLFromString(NSString *uri)
{
  if (![uri isKindOfClass:[NSString class]] || uri.length == 0) {
    return nil;
  }
  if ([uri hasPrefix:@"/"]) {
    return [NSURL fileURLWithPath:uri];
  }
  NSURL *url = [NSURL URLWithString:uri];
  if (url == nil && [uri hasPrefix:@"file://"]) {
    NSString *path = [[uri substringFromIndex:7] stringByRemovingPercentEncoding];
    url = path ? [NSURL fileURLWithPath:path] : nil;
  }
  return url;
}

static CGSize CEUprightSize(CGSize natural, CGAffineTransform transform)
{
  CGRect rect = CGRectApplyAffineTransform(CGRectMake(0, 0, natural.width, natural.height), transform);
  return CGSizeMake(fabs(rect.size.width), fabs(rect.size.height));
}

static CGFloat CEEven(CGFloat value)
{
  CGFloat rounded = round(value);
  return MAX(2, rounded - fmod(rounded, 2));
}

/// Fits `size` so the long side <= maxLong and the short side <= 1080.
static CGSize CEFitRenderSize(CGSize size, CGFloat maxLong)
{
  if (size.width <= 0 || size.height <= 0) {
    return CGSizeMake(1080, 1920);
  }
  CGFloat longSide = MAX(size.width, size.height);
  CGFloat shortSide = MIN(size.width, size.height);
  CGFloat scale = MIN(1.0, MIN(maxLong / longSide, kMaxShortSide / shortSide));
  return CGSizeMake(CEEven(size.width * scale), CEEven(size.height * scale));
}

static NSString *CETempDirectory(NSString *name)
{
  NSString *dir = [NSTemporaryDirectory() stringByAppendingPathComponent:name];
  [[NSFileManager defaultManager] createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:nil];
  return dir;
}

static NSString *_Nullable CEWriteJPEG(CGImageRef image, NSString *dirName)
{
  if (image == NULL) {
    return nil;
  }
  NSData *data = UIImageJPEGRepresentation([UIImage imageWithCGImage:image], 0.75);
  if (data == nil) {
    return nil;
  }
  NSString *path = [CETempDirectory(dirName)
      stringByAppendingPathComponent:[[NSUUID UUID].UUIDString stringByAppendingPathExtension:@"jpg"]];
  if (![data writeToFile:path atomically:YES]) {
    return nil;
  }
  return [NSURL fileURLWithPath:path].absoluteString;
}

/// Remote tracks (and Metro-served dev assets) are downloaded before composing.
static NSURL *_Nullable CELocalAudioURL(NSString *uri, NSError **error)
{
  NSURL *url = CEURLFromString(uri);
  if (url == nil) {
    return nil;
  }
  NSString *scheme = url.scheme.lowercaseString;
  if (![scheme isEqualToString:@"http"] && ![scheme isEqualToString:@"https"]) {
    return url;
  }
  NSString *ext = url.pathExtension.length > 0 ? url.pathExtension : @"m4a";
  NSString *name = [NSString stringWithFormat:@"%lu.%@", (unsigned long)uri.hash, ext];
  NSString *path = [CETempDirectory(@"clip-music") stringByAppendingPathComponent:name];
  if (![[NSFileManager defaultManager] fileExistsAtPath:path]) {
    NSData *data = [NSData dataWithContentsOfURL:url options:0 error:error];
    if (data == nil || ![data writeToFile:path atomically:YES]) {
      return nil;
    }
  }
  return [NSURL fileURLWithPath:path];
}

static double CEClamp(double value, double lo, double hi)
{
  return MIN(hi, MAX(lo, value));
}

@implementation ClipEditor {
  dispatch_queue_t _queue;
  AVAssetExportSession *_Nullable _session;
}

RCT_EXPORT_MODULE(ClipEditor)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if (self = [super init]) {
    _queue = dispatch_queue_create("com.anticlock.clipeditor", DISPATCH_QUEUE_SERIAL);
  }
  return self;
}

- (void)getInfo:(NSString *)uri resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(_queue, ^{
    NSURL *url = CEURLFromString(uri);
    if (url == nil) {
      reject(@"E_URI", @"Invalid video URI", nil);
      return;
    }
    AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url
                                            options:@{AVURLAssetPreferPreciseDurationAndTimingKey : @YES}];
    AVAssetTrack *video = [asset tracksWithMediaType:AVMediaTypeVideo].firstObject;
    if (video == nil) {
      reject(@"E_NO_VIDEO", @"This file has no readable video track", nil);
      return;
    }
    CGSize size = CEUprightSize(video.naturalSize, video.preferredTransform);
    BOOL hasAudio = [asset tracksWithMediaType:AVMediaTypeAudio].count > 0;
    resolve(@{
      @"durationMs" : @(CMTimeGetSeconds(asset.duration) * 1000.0),
      @"width" : @(size.width),
      @"height" : @(size.height),
      @"hasAudio" : @(hasAudio),
    });
  });
}

- (void)generateThumbnails:(NSArray *)uris
                     count:(double)count
                   widthPx:(double)widthPx
                   resolve:(RCTPromiseResolveBlock)resolve
                    reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(_queue, ^{
    NSMutableArray<AVAssetImageGenerator *> *generators = [NSMutableArray array];
    NSMutableArray<NSNumber *> *durations = [NSMutableArray array];
    double total = 0;
    for (id value in uris) {
      NSURL *url = CEURLFromString(value);
      if (url == nil) {
        continue;
      }
      AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url options:nil];
      double ms = CMTimeGetSeconds(asset.duration) * 1000.0;
      if (!(ms > 0)) {
        continue;
      }
      AVAssetImageGenerator *generator = [AVAssetImageGenerator assetImageGeneratorWithAsset:asset];
      generator.appliesPreferredTrackTransform = YES;
      generator.maximumSize = CGSizeMake(widthPx, widthPx * 2);
      generator.requestedTimeToleranceBefore = CMTimeMakeWithSeconds(0.5, 600);
      generator.requestedTimeToleranceAfter = CMTimeMakeWithSeconds(0.5, 600);
      [generators addObject:generator];
      [durations addObject:@(ms)];
      total += ms;
    }
    if (generators.count == 0) {
      reject(@"E_THUMBS", @"No readable video to create thumbnails from", nil);
      return;
    }
    NSInteger n = MAX(1, MIN(30, (NSInteger)llround(count)));
    NSMutableArray<NSString *> *out = [NSMutableArray arrayWithCapacity:n];
    for (NSInteger i = 0; i < n; i++) {
      double t = total * ((double)i + 0.5) / (double)n;
      NSUInteger index = 0;
      while (index < durations.count - 1 && t >= durations[index].doubleValue) {
        t -= durations[index].doubleValue;
        index++;
      }
      CGImageRef image = [generators[index] copyCGImageAtTime:CMTimeMakeWithSeconds(t / 1000.0, 600)
                                                   actualTime:NULL
                                                        error:nil];
      NSString *written = CEWriteJPEG(image, @"clip-thumbs");
      if (image != NULL) {
        CGImageRelease(image);
      }
      if (written != nil) {
        [out addObject:written];
      }
    }
    resolve(@{@"uris" : out, @"durationMs" : @(total)});
  });
}

- (void)exportClip:(NSString *)optionsJson resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  dispatch_async(_queue, ^{
    @synchronized(self) {
      if (self->_session != nil) {
        reject(@"E_BUSY", @"Another export is already running", nil);
        return;
      }
    }
    NSError *error = nil;
    NSData *json = [optionsJson dataUsingEncoding:NSUTF8StringEncoding];
    NSDictionary *opts = json ? [NSJSONSerialization JSONObjectWithData:json options:0 error:&error] : nil;
    if (![opts isKindOfClass:[NSDictionary class]]) {
      reject(@"E_OPTIONS", @"Invalid export options", error);
      return;
    }
    NSArray *sources = [opts[@"sources"] isKindOfClass:[NSArray class]] ? opts[@"sources"] : @[];
    double trimStart = MAX(0, [opts[@"trimStartMs"] doubleValue]);
    double trimEnd = [opts[@"trimEndMs"] doubleValue];
    if (!(trimEnd > trimStart)) {
      trimEnd = DBL_MAX;
    }
    double originalVolume = opts[@"originalVolume"] ? CEClamp([opts[@"originalVolume"] doubleValue], 0, 1) : 1;
    CGFloat maxLong = [opts[@"maxLongSide"] doubleValue] > 0 ? [opts[@"maxLongSide"] doubleValue] : 1920;
    NSDictionary *music = [opts[@"music"] isKindOfClass:[NSDictionary class]] ? opts[@"music"] : nil;
    NSNumber *coverAtMs = [opts[@"coverAtMs"] isKindOfClass:[NSNumber class]] ? opts[@"coverAtMs"] : nil;

    AVMutableComposition *composition = [AVMutableComposition composition];
    AVMutableCompositionTrack *compVideo =
        [composition addMutableTrackWithMediaType:AVMediaTypeVideo preferredTrackID:kCMPersistentTrackID_Invalid];
    AVMutableCompositionTrack *compAudio = nil;
    if (originalVolume > 0.001) {
      compAudio = [composition addMutableTrackWithMediaType:AVMediaTypeAudio
                                           preferredTrackID:kCMPersistentTrackID_Invalid];
    }

    NSMutableArray<NSDictionary *> *segments = [NSMutableArray array];
    CMTime cursor = kCMTimeZero;
    double offsetMs = 0;
    CGSize firstUpright = CGSizeZero;
    BOOL insertedAudio = NO;

    for (id value in sources) {
      NSURL *url = CEURLFromString(value);
      if (url == nil) {
        continue;
      }
      AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url
                                              options:@{AVURLAssetPreferPreciseDurationAndTimingKey : @YES}];
      AVAssetTrack *video = [asset tracksWithMediaType:AVMediaTypeVideo].firstObject;
      if (video == nil) {
        reject(@"E_NO_VIDEO", @"One of the clips has no readable video track", nil);
        return;
      }
      double durationMs = CMTimeGetSeconds(asset.duration) * 1000.0;
      double segStart = offsetMs;
      double segEnd = offsetMs + durationMs;
      offsetMs = segEnd;
      double from = MAX(trimStart, segStart);
      double to = MIN(trimEnd, segEnd);
      if (to - from < 1) {
        continue;
      }
      CMTimeRange range = CMTimeRangeFromTimeToTime(CMTimeMakeWithSeconds((from - segStart) / 1000.0, 600),
                                                    CMTimeMakeWithSeconds((to - segStart) / 1000.0, 600));
      range = CMTimeRangeGetIntersection(range, video.timeRange);
      if (CMTIMERANGE_IS_EMPTY(range)) {
        continue;
      }
      if (![compVideo insertTimeRange:range ofTrack:video atTime:cursor error:&error]) {
        reject(@"E_COMPOSE", error.localizedDescription ?: @"Could not combine the clips", error);
        return;
      }
      if (compAudio != nil) {
        AVAssetTrack *audio = [asset tracksWithMediaType:AVMediaTypeAudio].firstObject;
        if (audio != nil) {
          CMTimeRange audioRange = CMTimeRangeGetIntersection(range, audio.timeRange);
          if (!CMTIMERANGE_IS_EMPTY(audioRange) &&
              [compAudio insertTimeRange:audioRange ofTrack:audio atTime:cursor error:nil]) {
            insertedAudio = YES;
          }
        }
      }
      if (CGSizeEqualToSize(firstUpright, CGSizeZero)) {
        firstUpright = CEUprightSize(video.naturalSize, video.preferredTransform);
      }
      [segments addObject:@{
        @"start" : [NSValue valueWithCMTime:cursor],
        @"transform" : [NSValue valueWithCGAffineTransform:video.preferredTransform],
        @"natural" : [NSValue valueWithCGSize:video.naturalSize],
      }];
      cursor = CMTimeAdd(cursor, range.duration);
    }

    CMTime total = cursor;
    if (segments.count == 0 || CMTimeGetSeconds(total) <= 0) {
      reject(@"E_EMPTY", @"Nothing left to export after trimming", nil);
      return;
    }
    if (compAudio != nil && !insertedAudio) {
      [composition removeTrack:compAudio];
      compAudio = nil;
    }

    // Music starts at `startMs` in the track and loops from the beginning if
    // the rest of the track is shorter than the clip.
    AVMutableCompositionTrack *compMusic = nil;
    double musicVolume = 1;
    if (music != nil) {
      NSURL *musicURL = CELocalAudioURL([music[@"uri"] description], &error);
      AVAssetTrack *musicTrack = nil;
      if (musicURL != nil) {
        AVURLAsset *musicAsset = [AVURLAsset URLAssetWithURL:musicURL options:nil];
        musicTrack = [musicAsset tracksWithMediaType:AVMediaTypeAudio].firstObject;
      }
      if (musicTrack == nil) {
        reject(@"E_MUSIC", @"The selected music could not be loaded", error);
        return;
      }
      musicVolume = music[@"volume"] ? CEClamp([music[@"volume"] doubleValue], 0, 1) : 1;
      compMusic = [composition addMutableTrackWithMediaType:AVMediaTypeAudio
                                           preferredTrackID:kCMPersistentTrackID_Invalid];
      CMTime trackDuration = musicTrack.timeRange.duration;
      CMTime sourceStart = CMTimeMakeWithSeconds(MAX(0, [music[@"startMs"] doubleValue]) / 1000.0, 600);
      if (CMTimeCompare(sourceStart, trackDuration) >= 0) {
        sourceStart = kCMTimeZero;
      }
      CMTime at = kCMTimeZero;
      int guard = 0;
      while (CMTimeCompare(at, total) < 0 && guard++ < 64) {
        CMTime remaining = CMTimeSubtract(total, at);
        CMTime available = CMTimeSubtract(trackDuration, sourceStart);
        CMTime length = CMTimeMinimum(remaining, available);
        if (CMTimeGetSeconds(length) < 0.01) {
          break;
        }
        CMTimeRange sourceRange = CMTimeRangeMake(CMTimeAdd(musicTrack.timeRange.start, sourceStart), length);
        if (![compMusic insertTimeRange:sourceRange ofTrack:musicTrack atTime:at error:&error]) {
          reject(@"E_MUSIC", error.localizedDescription ?: @"Could not add the music", error);
          return;
        }
        at = CMTimeAdd(at, length);
        sourceStart = kCMTimeZero;
      }
    }

    NSMutableArray<AVAudioMixInputParameters *> *mixParams = [NSMutableArray array];
    if (compAudio != nil) {
      AVMutableAudioMixInputParameters *p = [AVMutableAudioMixInputParameters audioMixInputParametersWithTrack:compAudio];
      [p setVolume:(float)originalVolume atTime:kCMTimeZero];
      [mixParams addObject:p];
    }
    if (compMusic != nil) {
      AVMutableAudioMixInputParameters *p = [AVMutableAudioMixInputParameters audioMixInputParametersWithTrack:compMusic];
      [p setVolume:(float)musicVolume atTime:kCMTimeZero];
      [mixParams addObject:p];
    }

    // Upright every segment and fit it into a single render size.
    CGSize renderSize = CEFitRenderSize(firstUpright, maxLong);
    AVMutableVideoComposition *videoComposition = [AVMutableVideoComposition videoComposition];
    videoComposition.renderSize = renderSize;
    videoComposition.frameDuration = CMTimeMake(1, 30);
    // Output SDR BT.709 (HDR iPhone footage is tone-mapped) for broad playback.
    videoComposition.colorPrimaries = AVVideoColorPrimaries_ITU_R_709_2;
    videoComposition.colorTransferFunction = AVVideoTransferFunction_ITU_R_709_2;
    videoComposition.colorYCbCrMatrix = AVVideoYCbCrMatrix_ITU_R_709_2;
    AVMutableVideoCompositionInstruction *instruction = [AVMutableVideoCompositionInstruction videoCompositionInstruction];
    instruction.timeRange = CMTimeRangeMake(kCMTimeZero, total);
    AVMutableVideoCompositionLayerInstruction *layer =
        [AVMutableVideoCompositionLayerInstruction videoCompositionLayerInstructionWithAssetTrack:compVideo];
    for (NSDictionary *segment in segments) {
      CGAffineTransform transform = [segment[@"transform"] CGAffineTransformValue];
      CGSize natural = [segment[@"natural"] CGSizeValue];
      CGRect rect = CGRectApplyAffineTransform(CGRectMake(0, 0, natural.width, natural.height), transform);
      CGAffineTransform normalized =
          CGAffineTransformConcat(transform, CGAffineTransformMakeTranslation(-rect.origin.x, -rect.origin.y));
      CGSize upright = CGSizeMake(fabs(rect.size.width), fabs(rect.size.height));
      CGFloat scale = MIN(renderSize.width / upright.width, renderSize.height / upright.height);
      CGAffineTransform scaled = CGAffineTransformConcat(normalized, CGAffineTransformMakeScale(scale, scale));
      CGFloat dx = (renderSize.width - upright.width * scale) / 2.0;
      CGFloat dy = (renderSize.height - upright.height * scale) / 2.0;
      CGAffineTransform fitted = CGAffineTransformConcat(scaled, CGAffineTransformMakeTranslation(dx, dy));
      [layer setTransform:fitted atTime:[segment[@"start"] CMTimeValue]];
    }
    instruction.layerInstructions = @[ layer ];
    videoComposition.instructions = @[ instruction ];

    NSString *outPath = [CETempDirectory(@"clip-export")
        stringByAppendingPathComponent:[NSString stringWithFormat:@"clip-%@.mp4", [NSUUID UUID].UUIDString]];
    NSURL *outURL = [NSURL fileURLWithPath:outPath];
    AVAssetExportSession *session = [[AVAssetExportSession alloc] initWithAsset:composition
                                                                     presetName:AVAssetExportPresetHighestQuality];
    if (session == nil) {
      reject(@"E_EXPORT", @"This device cannot export the clip", nil);
      return;
    }
    session.outputURL = outURL;
    session.outputFileType = AVFileTypeMPEG4;
    session.shouldOptimizeForNetworkUse = YES;
    session.videoComposition = videoComposition;
    if (mixParams.count > 0) {
      AVMutableAudioMix *mix = [AVMutableAudioMix audioMix];
      mix.inputParameters = mixParams;
      session.audioMix = mix;
    }
    @synchronized(self) {
      self->_session = session;
    }

    [session exportAsynchronouslyWithCompletionHandler:^{
      dispatch_async(self->_queue, ^{
        @synchronized(self) {
          self->_session = nil;
        }
        if (session.status == AVAssetExportSessionStatusCancelled) {
          [[NSFileManager defaultManager] removeItemAtURL:outURL error:nil];
          reject(@"E_CANCELLED", @"Export cancelled", nil);
          return;
        }
        if (session.status != AVAssetExportSessionStatusCompleted) {
          [[NSFileManager defaultManager] removeItemAtURL:outURL error:nil];
          reject(@"E_EXPORT", session.error.localizedDescription ?: @"Export failed", session.error);
          return;
        }
        AVURLAsset *output = [AVURLAsset URLAssetWithURL:outURL
                                                 options:@{AVURLAssetPreferPreciseDurationAndTimingKey : @YES}];
        AVAssetTrack *outVideo = [output tracksWithMediaType:AVMediaTypeVideo].firstObject;
        CGSize outSize = outVideo ? CEUprightSize(outVideo.naturalSize, outVideo.preferredTransform) : renderSize;
        NSDictionary *attrs = [[NSFileManager defaultManager] attributesOfItemAtPath:outPath error:nil];
        id coverUri = [NSNull null];
        if (coverAtMs != nil) {
          AVAssetImageGenerator *generator = [AVAssetImageGenerator assetImageGeneratorWithAsset:output];
          generator.appliesPreferredTrackTransform = YES;
          generator.maximumSize = CGSizeMake(maxLong, maxLong);
          double maxCover = MAX(0, CMTimeGetSeconds(output.duration) * 1000.0 - 50);
          CMTime at = CMTimeMakeWithSeconds(CEClamp(coverAtMs.doubleValue, 0, maxCover) / 1000.0, 600);
          CGImageRef image = [generator copyCGImageAtTime:at actualTime:NULL error:nil];
          NSString *written = CEWriteJPEG(image, @"clip-covers");
          if (image != NULL) {
            CGImageRelease(image);
          }
          if (written != nil) {
            coverUri = written;
          }
        }
        resolve(@{
          @"uri" : outURL.absoluteString,
          @"durationMs" : @(CMTimeGetSeconds(output.duration) * 1000.0),
          @"width" : @(outSize.width),
          @"height" : @(outSize.height),
          @"byteSize" : @([attrs fileSize]),
          @"coverUri" : coverUri,
        });
      });
    }];
  });
}

- (void)cancelExport
{
  @synchronized(self) {
    [_session cancelExport];
  }
}

- (NSNumber *)getExportProgress
{
  @synchronized(self) {
    return @(_session != nil ? _session.progress : 0);
  }
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeClipEditorSpecJSI>(params);
}

@end

#pragma clang diagnostic pop
