Pod::Spec.new do |s|
  s.name           = 'ExpoMpvPlayer'
  s.version        = '0.1.0'
  s.summary        = 'Expo module wrapping libmpv for video playback'
  s.description    = 'Expo module wrapping libmpv via MPVKit for Android and iOS video playback'
  s.author         = 'seanime'
  s.homepage       = 'https://github.com/5rahim/seanime'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'MPVKit-GPL'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'VALID_ARCHS' => 'arm64 x86_64',
    'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'i386',
    'DEBUG_INFORMATION_FORMAT' => 'dwarf',
    'STRIP_INSTALLED_PRODUCT' => 'YES',
    'DEPLOYMENT_POSTPROCESSING' => 'YES',
  }

  s.user_target_xcconfig = {
    'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'i386'
  }

  s.source_files = "*.{h,m,mm,swift,hpp,cpp}"
end
