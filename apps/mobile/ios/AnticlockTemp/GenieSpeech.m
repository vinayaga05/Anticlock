#import <AVFoundation/AVFoundation.h>
#import <React/RCTBridgeModule.h>

@interface GenieSpeech : NSObject <RCTBridgeModule, AVSpeechSynthesizerDelegate>
@property(nonatomic, strong) AVSpeechSynthesizer *synthesizer;
@property(nonatomic, strong) AVSpeechUtterance *utterance;
@property(nonatomic, copy) RCTPromiseResolveBlock completion;
@end

@implementation GenieSpeech

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup { return YES; }

- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

RCT_REMAP_METHOD(speak, say:(NSString *)text
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  [self stop];
  if (text.length == 0) { resolve(nil); return; }
  if (!self.synthesizer) {
    self.synthesizer = [[AVSpeechSynthesizer alloc] init];
    self.synthesizer.delegate = self;
  }
  self.utterance = [AVSpeechUtterance speechUtteranceWithString:text];
  self.completion = resolve;
  [self.synthesizer speakUtterance:self.utterance];
}

RCT_EXPORT_METHOD(stop) {
  RCTPromiseResolveBlock resolve = self.completion;
  self.completion = nil;
  self.utterance = nil;
  [self.synthesizer stopSpeakingAtBoundary:AVSpeechBoundaryImmediate];
  if (resolve) resolve(nil);
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)synthesizer didFinishSpeechUtterance:(AVSpeechUtterance *)utterance {
  if (utterance == self.utterance) [self stop];
}

- (void)speechSynthesizer:(AVSpeechSynthesizer *)synthesizer didCancelSpeechUtterance:(AVSpeechUtterance *)utterance {
  if (utterance == self.utterance) [self stop];
}

@end
