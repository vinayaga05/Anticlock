require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "AnticlockClipEditor"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/vinayaga05/Anticlock"
  s.license      = { :type => "UNLICENSED" }
  s.authors      = "Anticlock"
  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => "https://github.com/vinayaga05/Anticlock.git", :tag => "#{s.version}" }
  s.source_files = "ios/**/*.{h,m,mm}"
  s.frameworks   = "AVFoundation", "CoreMedia", "UIKit"

  install_modules_dependencies(s)
end
