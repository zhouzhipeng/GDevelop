// @flow
// Fixed authoring API for bundled instructions. Edit this table when adding a
// system action/condition; never derive names from project load order or prose.
// Identity: kind|extension|objectType|behaviorType|nativeType.
export const SYSTEM_INSTRUCTION_NAMES: { [string]: string } = {
  'action|BuiltinObject|||ActivateBehavior': 'activateBehavior',
  'action|AdMob|||AdMob::ClaimReward': 'claimReward',
  'action|AdMob|||AdMob::ClaimRewardedInterstitialReward':
    'claimRewardedInterstitialReward',
  'action|AdMob|||AdMob::ClaimRewardedVideoReward': 'claimRewardedVideoReward',
  'action|AdMob|||AdMob::HideBanner': 'hideBanner',
  'action|AdMob|||AdMob::InitializeAdmob': 'initializeAdmob',
  'action|AdMob|||AdMob::LoadAppOpen': 'loadAppOpen',
  'action|AdMob|||AdMob::LoadBanner': 'loadBanner',
  'action|AdMob|||AdMob::LoadInterstitial': 'loadInterstitial',
  'action|AdMob|||AdMob::LoadRewardedInterstitial': 'loadRewardedInterstitial',
  'action|AdMob|||AdMob::LoadRewardedVideo': 'adMobLoadRewardedVideo',
  'action|AdMob|||AdMob::LoadVideo': 'loadVideo',
  'action|AdMob|||AdMob::PreventAdmobAutoInitialization':
    'preventAdmobAutoInitialization',
  'action|AdMob|||AdMob::RemoveBanner': 'removeBanner',
  'action|AdMob|||AdMob::SetTestMode': 'setTestMode',
  'action|AdMob|||AdMob::SetupBanner': 'setupBanner',
  'action|AdMob|||AdMob::ShowAppOpen': 'showAppOpen',
  'action|AdMob|||AdMob::ShowBanner': 'showBanner',
  'action|AdMob|||AdMob::ShowInterstitial': 'showInterstitial',
  'action|AdMob|||AdMob::ShowRewardedInterstitial': 'showRewardedInterstitial',
  'action|AdMob|||AdMob::ShowRewardedVideo': 'adMobShowRewardedVideo',
  'action|AdMob|||AdMob::ShowVideo': 'showVideo',
  'action|BuiltinObject|||AddForceAL': 'addForceAL',
  'action|BuiltinObject|||AddForceTowardObject': 'addForceTowardObject',
  'action|BuiltinObject|||AddForceTowardPosition': 'addForceTowardPosition',
  'action|BuiltinObject|||AddForceVers': 'addForceVers',
  'action|BuiltinObject|||AddForceVersPos': 'addForceVersPos',
  'action|BuiltinObject|||AddForceXY': 'addForceXY',
  'action|AdvancedTween||AdvancedTween::AdvancedTween|AdvancedTween::Pause':
    'advancedTweenPause',
  'action|AdvancedTween||AdvancedTween::AdvancedTween|AdvancedTween::Play':
    'advancedTweenPlay',
  'action|AdvancedTween||AdvancedTween::AdvancedTween|AdvancedTween::Resume':
    'resumeAdvancedTween',
  'action|AdvancedTween||AdvancedTween::AdvancedTween|AdvancedTween::SetCurrentTime':
    'setAdvancedTweenTime',
  'action|AdvancedTween||AdvancedTween::AdvancedTween|AdvancedTween::SetJson':
    'setAdvancedTweenJson',
  'action|AdvancedTween||AdvancedTween::AdvancedTween|AdvancedTween::doStepPostEvents':
    'doStepPostEvents',
  'action|AdvancedTween||AdvancedTween::AdvancedTween|AdvancedTween::doStepPreEvents':
    'doStepPreEvents',
  'action|AdvancedTween||AdvancedTween::AdvancedTween|AdvancedTween::onCreated':
    'onCreated',
  'action|AdvancedTween||AdvancedTween::AdvancedTween|AdvancedTween::onDestroy':
    'onDestroy',
  'action|AdvancedWindow|||AdvancedWindow::EnableContentProtection':
    'enableContentProtection',
  'action|AdvancedWindow|||AdvancedWindow::EnableWindow': 'enableWindow',
  'action|AdvancedWindow|||AdvancedWindow::Flash': 'flash',
  'action|AdvancedWindow|||AdvancedWindow::Focus': 'advancedWindowFocus',
  'action|AdvancedWindow|||AdvancedWindow::Maximize': 'maximize',
  'action|AdvancedWindow|||AdvancedWindow::Minimize': 'minimize',
  'action|AdvancedWindow|||AdvancedWindow::SetAlwaysOnTop': 'setAlwaysOnTop',
  'action|AdvancedWindow|||AdvancedWindow::SetClosable': 'setClosable',
  'action|AdvancedWindow|||AdvancedWindow::SetFocusable': 'setFocusable',
  'action|AdvancedWindow|||AdvancedWindow::SetFullScreenable':
    'setFullScreenable',
  'action|AdvancedWindow|||AdvancedWindow::SetHasShadow': 'setHasShadow',
  'action|AdvancedWindow|||AdvancedWindow::SetKiosk': 'setKiosk',
  'action|AdvancedWindow|||AdvancedWindow::SetMaximizable': 'setMaximizable',
  'action|AdvancedWindow|||AdvancedWindow::SetMinimizable': 'setMinimizable',
  'action|AdvancedWindow|||AdvancedWindow::SetMovable': 'setMovable',
  'action|AdvancedWindow|||AdvancedWindow::SetOpacity':
    'advancedWindowSetOpacity',
  'action|AdvancedWindow|||AdvancedWindow::SetResizable': 'setResizable',
  'action|AdvancedWindow|||AdvancedWindow::SetWindowPosition':
    'setWindowPosition',
  'action|AdvancedWindow|||AdvancedWindow::Show': 'advancedWindowShow',
  'action|BuiltinObject|||AjoutHasard': 'ajoutHasard',
  'action|BuiltinObject|||AjoutObjConcern': 'ajoutObjConcern',
  'action|AnimatableCapability||AnimatableCapability::AnimatableBehavior|AnimatableCapability::AnimatableBehavior::PauseAnimation':
    'pauseAnimation',
  'action|AnimatableCapability||AnimatableCapability::AnimatableBehavior|AnimatableCapability::AnimatableBehavior::PlayAnimation':
    'playAnimation',
  'action|AnimatableCapability||AnimatableCapability::AnimatableBehavior|AnimatableCapability::AnimatableBehavior::SetElapsedTime':
    'setAnimationElapsedTime',
  'action|AnimatableCapability||AnimatableCapability::AnimatableBehavior|AnimatableCapability::AnimatableBehavior::SetIndex':
    'setAnimationIndex',
  'action|AnimatableCapability||AnimatableCapability::AnimatableBehavior|AnimatableCapability::AnimatableBehavior::SetName':
    'setAnimationName',
  'action|AnimatableCapability||AnimatableCapability::AnimatableBehavior|AnimatableCapability::AnimatableBehavior::SetSpeedScale':
    'setAnimationSpeedScale',
  'action|BuiltinObject|||Arreter': 'arreter',
  'action|BBText|BBText::BBText||BBText::SetAlignment': 'bbTextSetAlignment',
  'action|BBText|BBText::BBText||BBText::SetBBText': 'setBBText',
  'action|BBText|BBText::BBText||BBText::SetColor': 'bbTextSetColor',
  'action|BBText|BBText::BBText||BBText::SetFontFamily': 'setFontFamily',
  'action|BBText|BBText::BBText||BBText::SetFontFamily2': 'setFontFamily2',
  'action|BBText|BBText::BBText||BBText::SetFontSize': 'bbTextSetFontSize',
  'action|BBText|BBText::BBText||BBText::SetOpacity': 'bbTextSetOpacity',
  'action|BBText|BBText::BBText||BBText::SetWordWrap': 'bbTextSetWordWrap',
  'action|BBText|BBText::BBText||BBText::SetWrappingWidth':
    'bbTextSetWrappingWidth',
  'action|BitmapText|BitmapText::BitmapTextObject||BitmapText::BitmapTextObject::SetOpacity':
    'bitmapTextSetOpacity',
  'action|BitmapText|BitmapText::BitmapTextObject||BitmapText::BitmapTextObject::SetScale':
    'setScale',
  'action|BitmapText|BitmapText::BitmapTextObject||BitmapText::BitmapTextObject::SetText':
    'bitmapTextSetText',
  'action|BitmapText|BitmapText::BitmapTextObject||BitmapText::BitmapTextObject::SetWrappingWidth':
    'bitmapTextSetWrappingWidth',
  'action|BitmapText|BitmapText::BitmapTextObject||BitmapText::SetAlignment':
    'bitmapTextSetAlignment',
  'action|BitmapText|BitmapText::BitmapTextObject||BitmapText::SetBitmapFontAndTextureAtlasResourceName':
    'setBitmapFontAndTextureAtlasResourceName',
  'action|BitmapText|BitmapText::BitmapTextObject||BitmapText::SetBitmapFontAndTextureAtlasResourceName2':
    'setBitmapFontAndTextureAtlasResourceName2',
  'action|BitmapText|BitmapText::BitmapTextObject||BitmapText::SetTint':
    'bitmapTextSetTint',
  'action|BitmapText|BitmapText::BitmapTextObject||BitmapText::SetWordWrap':
    'bitmapTextSetWordWrap',
  'action|BuiltinAsync|||BuiltinAsync::ResolveAsyncEventsFunction':
    'resolveAsyncEventsFunction',
  'action|BuiltinExternalLayouts|||BuiltinExternalLayouts::CreateObjectsFromExternalLayout':
    'createObjectsFromExternalLayout',
  'action|BuiltinObject|||Cache': 'cache',
  'action|BuiltinMouse|||CacheSouris': 'cacheSouris',
  'action|BuiltinCamera|||CameraX': 'cameraX',
  'action|BuiltinCamera|||CameraY': 'cameraY',
  'action|BuiltinCamera|||CenterCameraOnObject': 'centerCameraOnObject',
  'action|BuiltinWindow|||CenterWindow': 'centerWindow',
  'action|BuiltinCamera|||CentreCamera': 'centreCamera',
  'action|Sprite|Sprite||ChangeAnimation': 'changeAnimation',
  'action|Sprite|Sprite||ChangeAnimationSpeedScale':
    'changeAnimationSpeedScale',
  'action|Sprite|Sprite||ChangeBlendMode': 'changeBlendMode',
  'action|Sprite|Sprite||ChangeColor': 'spriteChangeColor',
  'action|Sprite|Sprite||ChangeDirection': 'changeDirection',
  'action|Sprite|Sprite||ChangeHeight': 'changeHeight',
  'action|BuiltinObject|||ChangeLayer': 'changeLayer',
  'action|BuiltinCamera|||ChangeLayerTimeScale': 'changeLayerTimeScale',
  'action|BuiltinObject|||ChangePlan': 'changePlan',
  'action|Sprite|Sprite||ChangeScale': 'changeScale',
  'action|Sprite|Sprite||ChangeScaleHeight': 'changeScaleHeight',
  'action|Sprite|Sprite||ChangeScaleWidth': 'changeScaleWidth',
  'action|Sprite|Sprite||ChangeSprite': 'changeSprite',
  'action|BuiltinTime|||ChangeTimeScale': 'changeTimeScale',
  'action|Sprite|Sprite||ChangeWidth': 'changeWidth',
  'action|BuiltinCamera|||ClampCamera': 'clampCamera',
  'action|BuiltinObject|||ClearForces': 'clearForces',
  'action|BuiltinVariables|||ClearVariableChildren': 'clearVariableChildren',
  'action|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::PinVertex':
    'pinVertex',
  'action|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::ResetPinning':
    'resetPinning',
  'action|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::ResetSimulation':
    'clothSimulationResetSimulation',
  'action|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::SetDamping':
    'setDamping',
  'action|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::SetGravity':
    'clothSimulationSetGravity',
  'action|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::SetSimulationEnabled':
    'clothSimulationSetSimulationEnabled',
  'action|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::SetSphereCollider':
    'setSphereCollider',
  'action|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::SetSphereColliderEnabled':
    'setSphereColliderEnabled',
  'action|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::SetStiffness':
    'setStiffness',
  'action|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::SetWind':
    'clothSimulationSetWind',
  'action|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::UnpinVertex':
    'unpinVertex',
  'action|BuiltinAdvanced|||CopyArgumentToVariable': 'copyArgumentToVariable',
  'action|BuiltinAdvanced|||CopyArgumentToVariable2': 'copyArgumentToVariable2',
  'action|BuiltinAdvanced|||CopyVariableToArgument': 'copyVariableToArgument',
  'action|BuiltinAdvanced|||CopyVariableToArgument2': 'copyVariableToArgument2',
  'action|BuiltinObject|||Create': 'createObject',
  'action|BuiltinObject|||CreateByName': 'createByName',
  'action|DebuggerTools|||DebuggerTools::ConsoleLog': 'log',
  'action|DebuggerTools|||DebuggerTools::EnableDebugDraw':
    'debuggerToolsEnableDebugDraw',
  'action|DebuggerTools|||DebuggerTools::Pause': 'debuggerToolsPause',
  'action|BuiltinObject|||Delete': 'deleteObject',
  'action|BuiltinFile|||DeleteFichier': 'deleteFichier',
  'action|BuiltinFile|||DeleteGroupFichier': 'deleteGroupFichier',
  'action|DestroyOutsideBehavior||DestroyOutsideBehavior::DestroyOutside|DestroyOutsideBehavior::DestroyOutside::SetExtraBorder':
    'setExtraBorder',
  'action|DestroyOutsideBehavior||DestroyOutsideBehavior::DestroyOutside|DestroyOutsideBehavior::DestroyOutside::SetUnseenGraceDistance':
    'setUnseenGraceDistance',
  'action|DestroyOutsideBehavior||DestroyOutsideBehavior::DestroyOutside|DestroyOutsideBehavior::ExtraBorder':
    'destroyOutsideBehaviorExtraBorder',
  'action|DeviceSensors|||DeviceSensors::ActivateMotionListener':
    'activateMotionListener',
  'action|DeviceSensors|||DeviceSensors::ActivateOrientationListener':
    'activateOrientationListener',
  'action|DeviceSensors|||DeviceSensors::DeactivateMotionListener':
    'deactivateMotionListener',
  'action|DeviceSensors|||DeviceSensors::DeactivateOrientationListener':
    'deactivateOrientationListener',
  'action|DeviceVibration|||DeviceVibration::StartVibration': 'startVibration',
  'action|DeviceVibration|||DeviceVibration::StartVibrationPattern':
    'startVibrationPattern',
  'action|DeviceVibration|||DeviceVibration::StopVibration': 'stopVibration',
  'action|DialogueTree|||DialogueTree::ClearState': 'clearDialogueState',
  'action|DialogueTree|||DialogueTree::CompleteClippedTextScrolling':
    'completeClippedTextScrolling',
  'action|DialogueTree|||DialogueTree::ConfirmSelectOption':
    'confirmSelectOption',
  'action|DialogueTree|||DialogueTree::GoToNextLine': 'goToNextLine',
  'action|DialogueTree|||DialogueTree::LoadDialogueFromJsonFile':
    'loadDialogueFromJsonFile',
  'action|DialogueTree|||DialogueTree::LoadDialogueFromSceneVariable':
    'loadDialogueFromSceneVariable',
  'action|DialogueTree|||DialogueTree::LoadState': 'loadDialogueState',
  'action|DialogueTree|||DialogueTree::SaveState': 'saveDialogueState',
  'action|DialogueTree|||DialogueTree::ScrollClippedText': 'scrollClippedText',
  'action|DialogueTree|||DialogueTree::SelectNextOption': 'selectNextOption',
  'action|DialogueTree|||DialogueTree::SelectOption': 'selectOption',
  'action|DialogueTree|||DialogueTree::SelectPreviousOption':
    'selectPreviousOption',
  'action|DialogueTree|||DialogueTree::SetBooleanVariable':
    'dialogueTreeSetBooleanVariable',
  'action|DialogueTree|||DialogueTree::SetNumberVariable':
    'dialogueTreeSetNumberVariable',
  'action|DialogueTree|||DialogueTree::SetStringVariable':
    'dialogueTreeSetStringVariable',
  'action|DialogueTree|||DialogueTree::StartDialogueFromBranch':
    'startDialogueFromBranch',
  'action|DialogueTree|||DialogueTree::StopRunningDialogue':
    'stopRunningDialogue',
  'action|BuiltinObject|||Ecarter': 'ecarter',
  'action|BuiltinFile|||EcrireFichierExp': 'ecrireFichierExp',
  'action|BuiltinFile|||EcrireFichierTxt': 'ecrireFichierTxt',
  'action|EffectCapability||EffectCapability::EffectBehavior|EffectCapability::EffectBehavior::EnableEffect':
    'enableEffect',
  'action|EffectCapability||EffectCapability::EffectBehavior|EffectCapability::EffectBehavior::SetEffectBooleanParameter':
    'setEffectBooleanParameter',
  'action|EffectCapability||EffectCapability::EffectBehavior|EffectCapability::EffectBehavior::SetEffectDoubleParameter':
    'setEffectDoubleParameter',
  'action|EffectCapability||EffectCapability::EffectBehavior|EffectCapability::EffectBehavior::SetEffectStringParameter':
    'setEffectStringParameter',
  'action|BuiltinScene|||EmitSceneSignal': 'emitSceneSignal',
  'action|BuiltinScene|||EmitSignalToObjectInstance':
    'emitSignalToObjectInstance',
  'action|BuiltinObject|||EnableEffect': 'objectEnableEffect',
  'action|BuiltinCamera|||EnableLayerEffect': 'enableLayerEffect',
  'action|BuiltinNetwork|||EnableMetrics': 'enableMetrics',
  'action|FacebookInstantGames|||FacebookInstantGames::LoadInterstitialAd':
    'loadInterstitialAd',
  'action|FacebookInstantGames|||FacebookInstantGames::LoadPlayerData':
    'loadPlayerData',
  'action|FacebookInstantGames|||FacebookInstantGames::LoadPlayerEntry':
    'loadPlayerEntry',
  'action|FacebookInstantGames|||FacebookInstantGames::LoadRewardedVideo':
    'facebookInstantGamesLoadRewardedVideo',
  'action|FacebookInstantGames|||FacebookInstantGames::SavePlayerData':
    'savePlayerData',
  'action|FacebookInstantGames|||FacebookInstantGames::SavePlayerScore':
    'facebookInstantGamesSavePlayerScore',
  'action|FacebookInstantGames|||FacebookInstantGames::ShowInterstitialAd':
    'showInterstitialAd',
  'action|FacebookInstantGames|||FacebookInstantGames::ShowRewardedVideo':
    'facebookInstantGamesShowRewardedVideo',
  'action|BuiltinAudio|||FadeMusicVolume': 'fadeMusicVolume',
  'action|BuiltinAudio|||FadeSoundVolume': 'fadeSoundVolume',
  'action|FileSystem|||FileSystem::DeleteFile': 'deleteFile',
  'action|FileSystem|||FileSystem::DeleteFileAsync': 'deleteFileAsync',
  'action|FileSystem|||FileSystem::LoadStringFromFileAsync':
    'loadStringFromFileAsync',
  'action|FileSystem|||FileSystem::LoadStringFromFileSync':
    'loadStringFromFileSync',
  'action|FileSystem|||FileSystem::LoadVariableFromJSONFileAsync':
    'loadVariableFromJSONFileAsync',
  'action|FileSystem|||FileSystem::LoadVariableFromJSONFileSync':
    'loadVariableFromJSONFileSync',
  'action|FileSystem|||FileSystem::MakeDirectory': 'makeDirectory',
  'action|FileSystem|||FileSystem::ReadDirectory': 'readDirectory',
  'action|FileSystem|||FileSystem::SaveStringToFileAsync':
    'saveStringToFileAsync',
  'action|FileSystem|||FileSystem::SaveStringToFileSync':
    'saveStringToFileSync',
  'action|FileSystem|||FileSystem::SaveVariableToJSONFileAsync':
    'saveVariableToJSONFileAsync',
  'action|FileSystem|||FileSystem::SaveVariableToJSONFileSync':
    'saveVariableToJSONFileSync',
  'action|Firebase|||Firebase::AddTracer': 'addTracer',
  'action|Firebase|||Firebase::AnalyticsEnable': 'analyticsEnable',
  'action|Firebase|||Firebase::AnalyticsLog': 'analyticsLog',
  'action|Firebase|||Firebase::AnalyticsSetProperty': 'analyticsSetProperty',
  'action|Firebase|||Firebase::AnalyticsSetUID': 'analyticsSetUID',
  'action|Firebase|||Firebase::AnonymousSignIn': 'anonymousSignIn',
  'action|Firebase|||Firebase::BasicAccountSignIn': 'basicAccountSignIn',
  'action|Firebase|||Firebase::CallHttpFunction': 'callHttpFunction',
  'action|Firebase|||Firebase::ChangeEmail': 'changeEmail',
  'action|Firebase|||Firebase::ChangeEmailProvider': 'changeEmailProvider',
  'action|Firebase|||Firebase::ChangePassword': 'changePassword',
  'action|Firebase|||Firebase::ChangePasswordProvider':
    'changePasswordProvider',
  'action|Firebase|||Firebase::CreateBasicAccount': 'createBasicAccount',
  'action|Firebase|||Firebase::DatabaseDeleteField': 'databaseDeleteField',
  'action|Firebase|||Firebase::DatabaseDeleteVariable':
    'databaseDeleteVariable',
  'action|Firebase|||Firebase::DatabaseGetField': 'databaseGetField',
  'action|Firebase|||Firebase::DatabaseGetVariable': 'databaseGetVariable',
  'action|Firebase|||Firebase::DatabaseHasField': 'databaseHasField',
  'action|Firebase|||Firebase::DatabaseHasVariable': 'databaseHasVariable',
  'action|Firebase|||Firebase::DatabaseUpdateField': 'databaseUpdateField',
  'action|Firebase|||Firebase::DatabaseUpdateVariable':
    'databaseUpdateVariable',
  'action|Firebase|||Firebase::DatabaseWriteField': 'databaseWriteField',
  'action|Firebase|||Firebase::DatabaseWriteVariable': 'databaseWriteVariable',
  'action|Firebase|||Firebase::DeleteUser': 'deleteUser',
  'action|Firebase|||Firebase::DeleteUserProvider': 'deleteUserProvider',
  'action|Firebase|||Firebase::EnablePerformance': 'enablePerformance',
  'action|Firebase|||Firebase::FirestoreAddDocument': 'firestoreAddDocument',
  'action|Firebase|||Firebase::FirestoreDeleteDocument':
    'firestoreDeleteDocument',
  'action|Firebase|||Firebase::FirestoreDeleteField': 'firestoreDeleteField',
  'action|Firebase|||Firebase::FirestoreDisableNetwork':
    'firestoreDisableNetwork',
  'action|Firebase|||Firebase::FirestoreDisablePersistence':
    'firestoreDisablePersistence',
  'action|Firebase|||Firebase::FirestoreEnableNetwork':
    'firestoreEnableNetwork',
  'action|Firebase|||Firebase::FirestoreEnablePersistence':
    'firestoreEnablePersistence',
  'action|Firebase|||Firebase::FirestoreExecuteQuery': 'firestoreExecuteQuery',
  'action|Firebase|||Firebase::FirestoreGetDocument': 'firestoreGetDocument',
  'action|Firebase|||Firebase::FirestoreGetField': 'firestoreGetField',
  'action|Firebase|||Firebase::FirestoreHasDocument': 'firestoreHasDocument',
  'action|Firebase|||Firebase::FirestoreHasField': 'firestoreHasField',
  'action|Firebase|||Firebase::FirestoreListDocuments':
    'firestoreListDocuments',
  'action|Firebase|||Firebase::FirestoreQueryLimit': 'firestoreQueryLimit',
  'action|Firebase|||Firebase::FirestoreQueryOrderBy': 'firestoreQueryOrderBy',
  'action|Firebase|||Firebase::FirestoreQuerySkipSome':
    'firestoreQuerySkipSome',
  'action|Firebase|||Firebase::FirestoreQueryWhereNumber':
    'firestoreQueryWhereNumber',
  'action|Firebase|||Firebase::FirestoreQueryWhereText':
    'firestoreQueryWhereText',
  'action|Firebase|||Firebase::FirestoreStartQuery': 'firestoreStartQuery',
  'action|Firebase|||Firebase::FirestoreStartQueryFrom':
    'firestoreStartQueryFrom',
  'action|Firebase|||Firebase::FirestoreUpdateDocument':
    'firestoreUpdateDocument',
  'action|Firebase|||Firebase::FirestoreUpdateField': 'firestoreUpdateField',
  'action|Firebase|||Firebase::FirestoreWatchQuery': 'firestoreWatchQuery',
  'action|Firebase|||Firebase::FirestoreWriteDocument':
    'firestoreWriteDocument',
  'action|Firebase|||Firebase::FirestoreWriteField': 'firestoreWriteField',
  'action|Firebase|||Firebase::ForceReloadRemoteConfig':
    'forceReloadRemoteConfig',
  'action|Firebase|||Firebase::Logout': 'logout',
  'action|Firebase|||Firebase::ProviderAccountSignIn': 'providerAccountSignIn',
  'action|Firebase|||Firebase::RecordTracer': 'recordTracer',
  'action|Firebase|||Firebase::SendEmailVerification': 'sendEmailVerification',
  'action|Firebase|||Firebase::SendPasswordResetEmail':
    'sendPasswordResetEmail',
  'action|Firebase|||Firebase::SetDisplayName': 'setDisplayName',
  'action|Firebase|||Firebase::SetPhotoURL': 'setPhotoURL',
  'action|Firebase|||Firebase::SetRemoteConfigAutoUpdateInterval':
    'setRemoteConfigAutoUpdateInterval',
  'action|Firebase|||Firebase::SetRemoteConfigDefaultConfig':
    'setRemoteConfigDefaultConfig',
  'action|Firebase|||Firebase::StartTracer': 'startTracer',
  'action|Firebase|||Firebase::StopTracer': 'stopTracer',
  'action|Firebase|||Firebase::StorageDownload': 'storageDownload',
  'action|Firebase|||Firebase::StorageUpload': 'storageUpload',
  'action|BuiltinCamera|||FixCamera': 'fixCamera',
  'action|Sprite|Sprite||FlipX': 'spriteFlipX',
  'action|Sprite|Sprite||FlipY': 'spriteFlipY',
  'action|FlippableCapability||FlippableCapability::FlippableBehavior|FlippableCapability::FlippableBehavior::FlipX':
    'flippableCapabilityFlipX',
  'action|FlippableCapability||FlippableCapability::FlippableBehavior|FlippableCapability::FlippableBehavior::FlipY':
    'flippableCapabilityFlipY',
  'action|BuiltinVariables|||GlobalVariableClearChildren':
    'globalVariableClearChildren',
  'action|BuiltinVariables|||GlobalVariablePush': 'globalVariablePush',
  'action|BuiltinVariables|||GlobalVariablePushBool': 'globalVariablePushBool',
  'action|BuiltinVariables|||GlobalVariablePushNumber':
    'globalVariablePushNumber',
  'action|BuiltinVariables|||GlobalVariablePushString':
    'globalVariablePushString',
  'action|BuiltinVariables|||GlobalVariableRemoveAt': 'globalVariableRemoveAt',
  'action|BuiltinVariables|||GlobalVariableRemoveChild':
    'globalVariableRemoveChild',
  'action|BuiltinObject|||Hide': 'hide',
  'action|BuiltinMouse|||HideCursor': 'hideCursor',
  'action|BuiltinCamera|||HideLayer': 'hideLayer',
  'action|BuiltinCommonConversions|||JSONToGlobalVariableStructure':
    'jsonToGlobalVariableStructure',
  'action|BuiltinCommonConversions|||JSONToObjectVariableStructure':
    'jsonToObjectVariableStructure',
  'action|BuiltinCommonConversions|||JSONToVariableStructure':
    'jsonToVariableStructure',
  'action|BuiltinCommonConversions|||JSONToVariableStructure2':
    'jsonToVariableStructure2',
  'action|BuiltinNetwork|||LaunchFile': 'launchFile',
  'action|Leaderboards|||Leaderboards::CloseLeaderboardView':
    'closeLeaderboardView',
  'action|Leaderboards|||Leaderboards::DisplayLeaderboard':
    'displayLeaderboard',
  'action|Leaderboards|||Leaderboards::SaveConnectedPlayerScore':
    'saveConnectedPlayerScore',
  'action|Leaderboards|||Leaderboards::SavePlayerScore':
    'leaderboardsSavePlayerScore',
  'action|Leaderboards|||Leaderboards::SetPreferSendConnectedPlayerScore':
    'setPreferSendConnectedPlayerScore',
  'action|Lighting|Lighting::LightObject||Lighting::SetColor':
    'lightingSetColor',
  'action|Lighting|Lighting::LightObject||Lighting::SetRadius': 'setRadius',
  'action|LinkedObjects|||LinkedObjects::LinkObjects': 'linkObjects',
  'action|LinkedObjects|||LinkedObjects::PickObjectsLinkedTo':
    'pickObjectsLinkedTo',
  'action|LinkedObjects|||LinkedObjects::RemoveAllLinksOf': 'removeAllLinksOf',
  'action|LinkedObjects|||LinkedObjects::RemoveLinkBetween':
    'removeLinkBetween',
  'action|BuiltinFile|||LireFichierExp': 'lireFichierExp',
  'action|BuiltinFile|||LireFichierTxt': 'lireFichierTxt',
  'action|BuiltinFile|||LoadFile': 'loadFile',
  'action|BuiltinScene|||LoadObjectAssets': 'loadObjectAssets',
  'action|BuiltinObject|||MettreAutour': 'mettreAutour',
  'action|BuiltinObject|||MettreAutourPos': 'mettreAutourPos',
  'action|BuiltinObject|||MettreX': 'objectSetX',
  'action|BuiltinObject|||MettreXY': 'objectSetXY',
  'action|BuiltinObject|||MettreY': 'objectSetY',
  'action|BuiltinAudio|||ModGlobalVolume': 'modGlobalVolume',
  'action|BuiltinAudio|||ModPitchMusicChannel': 'modPitchMusicChannel',
  'action|BuiltinAudio|||ModPitchSoundChannel': 'modPitchSoundChannel',
  'action|BuiltinAudio|||ModPlayingOffsetMusicChannel':
    'modPlayingOffsetMusicChannel',
  'action|BuiltinAudio|||ModPlayingOffsetSoundChannel':
    'modPlayingOffsetSoundChannel',
  'action|BuiltinVariables|||ModVarGlobal': 'modVarGlobal',
  'action|BuiltinVariables|||ModVarGlobalTxt': 'modVarGlobalTxt',
  'action|BuiltinObject|||ModVarObjet': 'modVarObjet',
  'action|BuiltinObject|||ModVarObjetTxt': 'modVarObjetTxt',
  'action|BuiltinVariables|||ModVarScene': 'modVarScene',
  'action|BuiltinVariables|||ModVarSceneTxt': 'modVarSceneTxt',
  'action|BuiltinAudio|||ModVolumeMusicCanal': 'modVolumeMusicCanal',
  'action|BuiltinAudio|||ModVolumeSoundCanal': 'modVolumeSoundCanal',
  'action|Model3DBoneAttachment||Model3DBoneAttachment::Model3DBoneAttachmentBehavior|Model3DBoneAttachment::Model3DBoneAttachmentBehavior::AttachToModelBone':
    'attachToModelBone',
  'action|Model3DBoneAttachment||Model3DBoneAttachment::Model3DBoneAttachmentBehavior|Model3DBoneAttachment::Model3DBoneAttachmentBehavior::DetachFromModelBone':
    'detachFromModelBone',
  'action|Model3DBoneAttachment||Model3DBoneAttachment::Model3DBoneAttachmentBehavior|Model3DBoneAttachment::Model3DBoneAttachmentBehavior::SetBoneAttachmentPositionOffset':
    'setBoneAttachmentPositionOffset',
  'action|Model3DBoneAttachment||Model3DBoneAttachment::Model3DBoneAttachmentBehavior|Model3DBoneAttachment::Model3DBoneAttachmentBehavior::SetBoneAttachmentRotationOffset':
    'setBoneAttachmentRotationOffset',
  'action|BuiltinObject|||Montre': 'montre',
  'action|BuiltinMouse|||MontreSouris': 'montreSouris',
  'action|BuiltinObject|||MoveObjects': 'moveObjects',
  'action|Multiplayer|||Multiplayer::CloseGameLobbies': 'closeGameLobbies',
  'action|Multiplayer|||Multiplayer::DisableVariableSynchronization':
    'disableVariableSynchronization',
  'action|Multiplayer|||Multiplayer::EndLobbyGame': 'endLobbyGame',
  'action|Multiplayer|||Multiplayer::EndLobbyWhenHostLeaves':
    'endLobbyWhenHostLeaves',
  'action|Multiplayer|||Multiplayer::GetMessageVariable': 'getMessageVariable',
  'action|Multiplayer|||Multiplayer::LeaveGameLobby': 'leaveGameLobby',
  'action|Multiplayer||Multiplayer::MultiplayerObjectBehavior|Multiplayer::MultiplayerObjectBehavior::EnableBehaviorSynchronization':
    'enableBehaviorSynchronization',
  'action|Multiplayer||Multiplayer::MultiplayerObjectBehavior|Multiplayer::MultiplayerObjectBehavior::RemoveObjectOwnership':
    'removeObjectOwnership',
  'action|Multiplayer||Multiplayer::MultiplayerObjectBehavior|Multiplayer::MultiplayerObjectBehavior::SetPlayerObjectOwnership':
    'setPlayerObjectOwnership',
  'action|Multiplayer||Multiplayer::MultiplayerObjectBehavior|Multiplayer::MultiplayerObjectBehavior::TakeObjectOwnership':
    'takeObjectOwnership',
  'action|Multiplayer|||Multiplayer::OpenGameLobbies': 'openGameLobbies',
  'action|Multiplayer|||Multiplayer::QuickJoinLobby': 'quickJoinLobby',
  'action|Multiplayer|||Multiplayer::QuickJoinWithLobbyID':
    'quickJoinWithLobbyID',
  'action|Multiplayer|||Multiplayer::RemoveVariableOwnership':
    'removeVariableOwnership',
  'action|Multiplayer|||Multiplayer::SendMessage': 'sendMessage',
  'action|Multiplayer|||Multiplayer::SendVariableMessage':
    'sendVariableMessage',
  'action|Multiplayer|||Multiplayer::SetObjectsSynchronizationRate':
    'setObjectsSynchronizationRate',
  'action|Multiplayer|||Multiplayer::SetPlayerVariableOwnership':
    'setPlayerVariableOwnership',
  'action|Multiplayer|||Multiplayer::ShowLobbiesWindowCloseAction':
    'showLobbiesWindowCloseAction',
  'action|Multiplayer|||Multiplayer::TakeVariableOwnership':
    'takeVariableOwnership',
  'action|NavMeshPathfinding|||NavMeshPathfinding::EnableDebugDraw':
    'navMeshPathfindingEnableDebugDraw',
  'action|NavMeshPathfinding||NavMeshPathfinding::NavMeshCharacterBehavior|NavMeshPathfinding::MoveTo':
    'moveAlongNavMesh',
  'action|NavMeshPathfinding||NavMeshPathfinding::NavMeshCharacterBehavior|NavMeshPathfinding::NavMeshCharacterBehavior::RotateObject':
    'navMeshPathfindingRotateObject',
  'action|NavMeshPathfinding||NavMeshPathfinding::NavMeshCharacterBehavior|NavMeshPathfinding::NavMeshCharacterBehavior::SetAcceleration':
    'setNavMeshAcceleration',
  'action|NavMeshPathfinding||NavMeshPathfinding::NavMeshCharacterBehavior|NavMeshPathfinding::NavMeshCharacterBehavior::SetAngleOffset':
    'setNavMeshAngleOffset',
  'action|NavMeshPathfinding||NavMeshPathfinding::NavMeshCharacterBehavior|NavMeshPathfinding::NavMeshCharacterBehavior::SetAngularMaxSpeed':
    'setNavMeshAngularMaxSpeed',
  'action|NavMeshPathfinding||NavMeshPathfinding::NavMeshCharacterBehavior|NavMeshPathfinding::NavMeshCharacterBehavior::SetMaxSpeed':
    'setNavMeshMaxSpeed',
  'action|NavMeshPathfinding||NavMeshPathfinding::NavMeshCharacterBehavior|NavMeshPathfinding::NavMeshCharacterBehavior::SetSpeed':
    'setNavMeshSpeed',
  'action|BuiltinObject|||ObjectVariableClearChildren':
    'objectVariableClearChildren',
  'action|BuiltinObject|||ObjectVariablePush': 'objectVariablePush',
  'action|BuiltinObject|||ObjectVariablePush2': 'objectVariablePush2',
  'action|BuiltinObject|||ObjectVariablePushBool': 'objectVariablePushBool',
  'action|BuiltinObject|||ObjectVariablePushNumber': 'objectVariablePushNumber',
  'action|BuiltinObject|||ObjectVariablePushString': 'objectVariablePushString',
  'action|BuiltinObject|||ObjectVariableRemoveAt': 'objectVariableRemoveAt',
  'action|BuiltinObject|||ObjectVariableRemoveChild':
    'objectVariableRemoveChild',
  'action|Sprite|Sprite||Opacity': 'spriteOpacity',
  'action|OpacityCapability||OpacityCapability::OpacityBehavior|OpacityCapability::OpacityBehavior::SetValue':
    'opacityCapabilitySetValue',
  'action|P2P|||P2P::Connect': 'connectToPeer',
  'action|P2P|||P2P::DisconnectFromAll': 'disconnectFromAll',
  'action|P2P|||P2P::DisconnectFromAllPeers': 'disconnectFromAllPeers',
  'action|P2P|||P2P::DisconnectFromBroker': 'disconnectFromBroker',
  'action|P2P|||P2P::DisconnectFromPeer': 'disconnectFromPeer',
  'action|P2P|||P2P::ForceRelayServer': 'forceRelayServer',
  'action|P2P|||P2P::GetEventVariable': 'getEventVariable',
  'action|P2P|||P2P::OverrideID': 'setPeerId',
  'action|P2P|||P2P::SendToAll': 'sendToAllPeers',
  'action|P2P|||P2P::SendToAllVariable': 'sendToAllVariable',
  'action|P2P|||P2P::SendToOne': 'sendToPeer',
  'action|P2P|||P2P::SendToOneVariable': 'sendToOneVariable',
  'action|P2P|||P2P::UseDefaultBroker': 'useDefaultBroker',
  'action|P2P|||P2P::UseOwnBroker': 'useOwnBroker',
  'action|P2P|||P2P::UseOwnICEServer': 'useOwnICEServer',
  'action|PanelSpriteObject|PanelSpriteObject::PanelSprite||PanelSpriteObject::Angle':
    'panelSpriteObjectAngle',
  'action|PanelSpriteObject|PanelSpriteObject::PanelSprite||PanelSpriteObject::Height':
    'panelSpriteObjectHeight',
  'action|PanelSpriteObject|PanelSpriteObject::PanelSprite||PanelSpriteObject::Image':
    'image',
  'action|PanelSpriteObject|PanelSpriteObject::PanelSprite||PanelSpriteObject::SetColor':
    'panelSpriteObjectSetColor',
  'action|PanelSpriteObject|PanelSpriteObject::PanelSprite||PanelSpriteObject::SetImageFromResource':
    'panelSpriteObjectSetImageFromResource',
  'action|PanelSpriteObject|PanelSpriteObject::PanelSprite||PanelSpriteObject::SetOpacity':
    'panelSpriteObjectSetOpacity',
  'action|PanelSpriteObject|PanelSpriteObject::PanelSprite||PanelSpriteObject::Width':
    'panelSpriteObjectWidth',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ConeSprayAngle':
    'coneSprayAngle',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::EmitterAngle':
    'emitterAngle',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::EmitterAngleA':
    'emitterAngleA',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::EmitterAngleB':
    'emitterAngleB',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::EmitterForceMax':
    'emitterForceMax',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::EmitterForceMin':
    'emitterForceMin',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::Flow':
    'flow',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::JumpEmitterForwardInTime':
    'jumpEmitterForwardInTime',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleAlpha1':
    'particleAlpha1',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleAlpha2':
    'particleAlpha2',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleBlue1':
    'particleBlue1',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleBlue2':
    'particleBlue2',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleColor1':
    'particleColor1',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleColor2':
    'particleColor2',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleEmitter::SetAdditiveRendering':
    'setAdditiveRendering',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleEmitter::SetMaxParticlesCount':
    'setMaxParticlesCount',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleEmitter::SetParticleRotationMaxSpeed':
    'setParticleRotationMaxSpeed',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleEmitter::SetParticleRotationMinSpeed':
    'setParticleRotationMinSpeed',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleGravityAngle':
    'particleGravityAngle',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleGravityLength':
    'particleGravityLength',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleGravityX':
    'particleGravityX',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleGravityY':
    'particleGravityY',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleGreen1':
    'particleGreen1',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleGreen2':
    'particleGreen2',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleLifeTimeMax':
    'particleLifeTimeMax',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleLifeTimeMin':
    'particleLifeTimeMin',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleRed1':
    'particleRed1',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleRed2':
    'particleRed2',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleSize1':
    'particleSize1',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleSize2':
    'particleSize2',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::RecreateParticleSystem':
    'recreateParticleSystem',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::SetFlow':
    'setFlow',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::SetTank':
    'setTank',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::SetTextureFromResource':
    'setTextureFromResource',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::StartEmission':
    'startEmission',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::StopEmission':
    'stopEmission',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::Tank':
    'tank',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::Texture':
    'texture',
  'action|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ZoneRadius':
    'zoneRadius',
  'action|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::Acceleration':
    'pathfindingBehaviorAcceleration',
  'action|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::AllowDiagonals':
    'pathfindingBehaviorAllowDiagonals',
  'action|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::AngleOffset':
    'pathfindingBehaviorAngleOffset',
  'action|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::AngularMaxSpeed':
    'pathfindingBehaviorAngularMaxSpeed',
  'action|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::CellHeight':
    'cellHeight',
  'action|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::CellWidth':
    'cellWidth',
  'action|PathfindingBehavior||PathfindingBehavior::PathfindingObstacleBehavior|PathfindingBehavior::Cost':
    'cost',
  'action|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::ExtraBorder':
    'pathfindingBehaviorExtraBorder',
  'action|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::MaxSpeed':
    'pathfindingBehaviorMaxSpeed',
  'action|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::PathfindingBehavior::SetGridOffsetX':
    'setGridOffsetX',
  'action|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::PathfindingBehavior::SetGridOffsetY':
    'setGridOffsetY',
  'action|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::RotateObject':
    'pathfindingBehaviorRotateObject',
  'action|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::SetDestination':
    'setDestination',
  'action|PathfindingBehavior||PathfindingBehavior::PathfindingObstacleBehavior|PathfindingBehavior::SetImpassable':
    'setImpassable',
  'action|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::Speed':
    'speed',
  'action|Sprite|Sprite||PauseAnimation': 'spritePauseAnimation',
  'action|BuiltinAudio|||PauseMusicCanal': 'pauseMusicCanal',
  'action|BuiltinAudio|||PauseMusicChannel': 'pauseMusicChannel',
  'action|BuiltinObject|||PauseObjectTimer': 'pauseObjectTimer',
  'action|BuiltinAudio|||PauseSoundCanal': 'pauseSoundCanal',
  'action|BuiltinAudio|||PauseSoundChannel': 'pauseSoundChannel',
  'action|BuiltinTime|||PauseTimer': 'pauseTimer',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::AddDistanceJoint':
    'addDistanceJoint',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::AddFrictionJoint':
    'addFrictionJoint',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::AddGearJoint':
    'addGearJoint',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::AddMotorJoint':
    'addMotorJoint',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::AddMouseJoint':
    'addMouseJoint',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::AddPrismaticJoint':
    'addPrismaticJoint',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::AddPulleyJoint':
    'addPulleyJoint',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::AddRevoluteJoint':
    'addRevoluteJoint',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::AddRevoluteJointBetweenTwoBodies':
    'addRevoluteJointBetweenTwoBodies',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::AddRopeJoint':
    'addRopeJoint',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::AddWeldJoint':
    'addWeldJoint',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::AddWheelJoint':
    'addWheelJoint',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::AngularDamping':
    'angularDamping',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::AngularVelocity':
    'angularVelocity',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::ApplyAngularImpulse':
    'physics2ApplyAngularImpulse',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::ApplyForce':
    'physics2ApplyForce',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::ApplyForceTowardPosition':
    'physics2ApplyForceTowardPosition',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::ApplyImpulse':
    'physics2ApplyImpulse',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::ApplyImpulseTowardPosition':
    'physics2ApplyImpulseTowardPosition',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::ApplyPolarForce':
    'applyPolarForce',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::ApplyPolarImpulse':
    'applyPolarImpulse',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::ApplyTorque':
    'physics2ApplyTorque',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::Density': 'density',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::DistanceJointDampingRatio':
    'distanceJointDampingRatio',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::DistanceJointFrequency':
    'distanceJointFrequency',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::DistanceJointLength':
    'distanceJointLength',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::EnableLayer':
    'physics2EnableLayer',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::EnableMask':
    'physics2EnableMask',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::EnablePrismaticJointLimits':
    'enablePrismaticJointLimits',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::EnablePrismaticJointMotor':
    'enablePrismaticJointMotor',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::EnableRevoluteJointLimits':
    'enableRevoluteJointLimits',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::EnableRevoluteJointMotor':
    'enableRevoluteJointMotor',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::EnableWheelJointMotor':
    'enableWheelJointMotor',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::Friction': 'friction',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::FrictionJointMaxForce':
    'frictionJointMaxForce',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::FrictionJointMaxTorque':
    'frictionJointMaxTorque',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::GearJointRatio':
    'gearJointRatio',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::Gravity':
    'physics2Gravity',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::GravityScale':
    'gravityScale',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::LinearDamping':
    'linearDamping',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::LinearVelocityAngle':
    'linearVelocityAngle',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::LinearVelocityX':
    'linearVelocityX',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::LinearVelocityY':
    'linearVelocityY',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::MotorJointAngularOffset':
    'motorJointAngularOffset',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::MotorJointCorrectionFactor':
    'motorJointCorrectionFactor',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::MotorJointMaxForce':
    'motorJointMaxForce',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::MotorJointMaxTorque':
    'motorJointMaxTorque',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::MotorJointOffset':
    'motorJointOffset',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::MouseJointDampingRatio':
    'mouseJointDampingRatio',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::MouseJointFrequency':
    'mouseJointFrequency',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::MouseJointMaxForce':
    'mouseJointMaxForce',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::MouseJointTarget':
    'mouseJointTarget',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::PrismaticJointLimits':
    'prismaticJointLimits',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::PrismaticJointMaxMotorForce':
    'prismaticJointMaxMotorForce',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::PrismaticJointMotorSpeed':
    'prismaticJointMotorSpeed',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::Remove joint':
    'removeJoint',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::Restitution':
    'restitution',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::RevoluteJointLimits':
    'revoluteJointLimits',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::RevoluteJointMaxMotorTorque':
    'revoluteJointMaxMotorTorque',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::RevoluteJointMotorSpeed':
    'revoluteJointMotorSpeed',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::RopeJointMaxLength':
    'ropeJointMaxLength',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::SetBullet':
    'physics2SetBullet',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::SetDynamic':
    'setDynamic',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::SetFixedRotation':
    'physics2SetFixedRotation',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::SetKinematic':
    'setKinematic',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::SetSleepingAllowed':
    'setSleepingAllowed',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::SetSleepingaAllowed':
    'setSleepingaAllowed',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::SetStatic':
    'setStatic',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::ShapeScale':
    'physics2ShapeScale',
  'action|Physics2|||Physics2::TimeScale': 'timeScale',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::WeldJointDampingRatio':
    'weldJointDampingRatio',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::WeldJointFrequency':
    'weldJointFrequency',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::WheelJointDampingRatio':
    'wheelJointDampingRatio',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::WheelJointFrequency':
    'wheelJointFrequency',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::WheelJointMaxMotorTorque':
    'wheelJointMaxMotorTorque',
  'action|Physics2||Physics2::Physics2Behavior|Physics2::WheelJointMotorSpeed':
    'wheelJointMotorSpeed',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::ApplyAngularImpulse':
    'physics3DApplyAngularImpulse',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::ApplyForce':
    'physics3DApplyForce',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::ApplyForceAtCenter':
    'applyForceAtCenter',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::ApplyForceTowardPosition':
    'physics3DApplyForceTowardPosition',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::ApplyImpulse':
    'physics3DApplyImpulse',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::ApplyImpulseAtCenter':
    'applyImpulseAtCenter',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::ApplyImpulseTowardPosition':
    'physics3DApplyImpulseTowardPosition',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::ApplyTorque':
    'physics3DApplyTorque',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::EnableLayer':
    'physics3DEnableLayer',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::EnableMask':
    'physics3DEnableMask',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetAngularDamping':
    'setAngularDamping',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetAngularVelocityX':
    'setAngularVelocityX',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetAngularVelocityY':
    'setAngularVelocityY',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetAngularVelocityZ':
    'setAngularVelocityZ',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetBodyType':
    'setBodyType',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetBullet':
    'physics3DSetBullet',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetDensity':
    'setDensity',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetFixedRotation':
    'physics3DSetFixedRotation',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetFriction':
    'setFriction',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetGravityScale':
    'physics3DSetGravityScale',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetGravityX':
    'setGravityX',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetGravityY':
    'setGravityY',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetGravityZ':
    'setGravityZ',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetLinearDamping':
    'setLinearDamping',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetLinearVelocityX':
    'setLinearVelocityX',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetLinearVelocityY':
    'setLinearVelocityY',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetLinearVelocityZ':
    'setLinearVelocityZ',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetRestitution':
    'setRestitution',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetShapeOffsetX':
    'setShapeOffsetX',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetShapeOffsetY':
    'setShapeOffsetY',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::SetShapeOffsetZ':
    'setShapeOffsetZ',
  'action|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::ShapeScale':
    'physics3DShapeScale',
  'action|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::SetEngineInertia':
    'setEngineInertia',
  'action|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::SetEngineSpeedMax':
    'setEngineSpeedMax',
  'action|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::SetEngineTorqueMax':
    'setEngineTorqueMax',
  'action|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::SimulateAcceleratorStick':
    'simulateAcceleratorStick',
  'action|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::SimulateBackwardKey':
    'physics3DSimulateBackwardKey',
  'action|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::SimulateForwardKey':
    'physics3DSimulateForwardKey',
  'action|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::SimulateHandBrakeKey':
    'simulateHandBrakeKey',
  'action|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::SimulateLeftKey':
    'physics3DSimulateLeftKey',
  'action|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::SimulateRightKey':
    'physics3DSimulateRightKey',
  'action|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::SimulateSteeringStick':
    'simulateSteeringStick',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::AbortJump':
    'physics3DAbortJump',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::FallingSpeedMax':
    'fallingSpeedMax',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetCanJump':
    'physics3DSetCanJump',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetCanNotAirJump':
    'physics3DSetCanNotAirJump',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetCurrentFallSpeed':
    'physics3DSetCurrentFallSpeed',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetCurrentForwardSpeed':
    'setCurrentForwardSpeed',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetCurrentJumpSpeed':
    'setCurrentJumpSpeed',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetCurrentSidewaysSpeed':
    'setCurrentSidewaysSpeed',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetForwardAcceleration':
    'setForwardAcceleration',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetForwardAngle':
    'setForwardAngle',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetForwardDeceleration':
    'setForwardDeceleration',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetForwardSpeedMax':
    'setForwardSpeedMax',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetGravity':
    'physics3DSetGravity',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetJumpSpeed':
    'setJumpSpeed',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetJumpSustainTime':
    'setJumpSustainTime',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetShouldBindObjectAndForwardAngle':
    'setShouldBindObjectAndForwardAngle',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetSidewaysAcceleration':
    'setSidewaysAcceleration',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetSidewaysDeceleration':
    'setSidewaysDeceleration',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SetSidewaysSpeedMax':
    'setSidewaysSpeedMax',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SimulateBackwardKey':
    'physics3DPhysicsCharacter3DSimulateBackwardKey',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SimulateForwardKey':
    'physics3DPhysicsCharacter3DSimulateForwardKey',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SimulateJumpKey':
    'physics3DSimulateJumpKey',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SimulateLeftKey':
    'physics3DPhysicsCharacter3DSimulateLeftKey',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SimulateRightKey':
    'physics3DPhysicsCharacter3DSimulateRightKey',
  'action|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SimulateStick':
    'physics3DSimulateStick',
  'action|BuiltinObject|||PickAllInstances': 'pickAllInstances',
  'action|BuiltinObject|||PickNearest': 'pickNearest',
  'action|BuiltinObject|||PickRandomInstance': 'pickRandomInstance',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::Acceleration':
    'platformBehaviorAcceleration',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::CanGrabPlatforms':
    'canGrabPlatforms',
  'action|PlatformBehavior||PlatformBehavior::PlatformBehavior|PlatformBehavior::ChangePlatformType':
    'changePlatformType',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::Deceleration':
    'platformBehaviorDeceleration',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::Gravity':
    'platformBehaviorGravity',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::IgnoreDefaultControls':
    'platformBehaviorIgnoreDefaultControls',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::JumpSpeed':
    'jumpSpeed',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::JumpSustainTime':
    'jumpSustainTime',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::LadderClimbingSpeed':
    'ladderClimbingSpeed',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::MaxFallingSpeed':
    'maxFallingSpeed',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::MaxSpeed':
    'platformBehaviorMaxSpeed',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::PlatformerObjectBehavior::AbortJump':
    'platformBehaviorAbortJump',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::PlatformerObjectBehavior::SetCanNotAirJump':
    'platformBehaviorSetCanNotAirJump',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::PlatformerObjectBehavior::SetCurrentFallSpeed':
    'platformBehaviorSetCurrentFallSpeed',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::PlatformerObjectBehavior::SetCurrentSpeed':
    'setCurrentSpeed',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::SetCanJump':
    'platformBehaviorSetCanJump',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::SimulateControl':
    'platformBehaviorSimulateControl',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::SimulateDownKey':
    'platformBehaviorSimulateDownKey',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::SimulateJumpKey':
    'platformBehaviorSimulateJumpKey',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::SimulateLadderKey':
    'simulateLadderKey',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::SimulateLeftKey':
    'platformBehaviorSimulateLeftKey',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::SimulateReleaseKey':
    'simulateReleaseKey',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::SimulateReleaseLadderKey':
    'simulateReleaseLadderKey',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::SimulateReleasePlatformKey':
    'simulateReleasePlatformKey',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::SimulateRightKey':
    'platformBehaviorSimulateRightKey',
  'action|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::SimulateUpKey':
    'platformBehaviorSimulateUpKey',
  'action|Sprite|Sprite||PlayAnimation': 'spritePlayAnimation',
  'action|BuiltinAudio|||PlayMusic': 'playMusic',
  'action|BuiltinAudio|||PlayMusicCanal': 'playMusicCanal',
  'action|BuiltinAudio|||PlayMusicOnChannel': 'playMusicOnChannel',
  'action|BuiltinAudio|||PlaySound': 'playSound',
  'action|BuiltinAudio|||PlaySoundCanal': 'playSoundCanal',
  'action|BuiltinAudio|||PlaySoundOnChannel': 'playSoundOnChannel',
  'action|PlayerAuthentication|||PlayerAuthentication::DisplayAuthenticationBanner':
    'displayAuthenticationBanner',
  'action|PlayerAuthentication|||PlayerAuthentication::HideAuthenticationBanner':
    'hideAuthenticationBanner',
  'action|PlayerAuthentication|||PlayerAuthentication::LogOut': 'logOut',
  'action|PlayerAuthentication|||PlayerAuthentication::OpenAuthenticationWindow':
    'openAuthenticationWindow',
  'action|BuiltinScene|||PopScene': 'popScene',
  'action|BuiltinAudio|||PreloadMusic': 'preloadMusic',
  'action|BuiltinAudio|||PreloadSound': 'preloadSound',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::Arc':
    'arc',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::BeginFillPath':
    'beginFillPath',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::BezierCurve':
    'bezierCurve',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::ChamferRectangle':
    'chamferRectangle',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::Circle':
    'circle',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::ClearBetweenFrames':
    'clearBetweenFrames',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::ClosePath':
    'primitiveDrawingClosePath',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::Drawer::ClearShapes':
    'clearShapes',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::Drawer::SetScaleX':
    'primitiveDrawingSetScaleX',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::Drawer::SetScaleY':
    'primitiveDrawingSetScaleY',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::Ellipse':
    'ellipse',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::EndFillPath':
    'endFillPath',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::FillColor':
    'fillColor',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::FillOpacity':
    'fillOpacity',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::FilletRectangle':
    'filletRectangle',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::FlipX':
    'primitiveDrawingFlipX',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::FlipY':
    'primitiveDrawingFlipY',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::Height':
    'primitiveDrawingHeight',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::Line':
    'line',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::LineV2':
    'lineV2',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::MovePathTo':
    'movePathTo',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::OutlineColor':
    'outlineColor',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::OutlineOpacity':
    'outlineOpacity',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::OutlineSize':
    'outlineSize',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::PathArc':
    'pathArc',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::PathBezierCurveTo':
    'pathBezierCurveTo',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::PathLineTo':
    'pathLineTo',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::PathMoveTo':
    'pathMoveTo',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::PathQuadraticCurveTo':
    'pathQuadraticCurveTo',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::QuadraticCurve':
    'quadraticCurve',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::Rectangle':
    'rectangle',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::RegularPolygon':
    'regularPolygon',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::RoundedRectangle':
    'roundedRectangle',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::Scale':
    'primitiveDrawingScale',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::SetAntialiasing':
    'setAntialiasing',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::SetRectangularCollisionMask':
    'setRectangularCollisionMask',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::SetRotationCenter':
    'setRotationCenter',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::Star':
    'star',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::Torus':
    'torus',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::UseRelativeCoordinates':
    'useRelativeCoordinates',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::Width':
    'primitiveDrawingWidth',
  'action|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::closePath':
    'primitiveDrawingDrawerClosePath',
  'action|BuiltinScene|||PrioritizeLoadingOfScene': 'prioritizeLoadingOfScene',
  'action|BuiltinVariables|||PushBoolean': 'pushBoolean',
  'action|BuiltinObject|||PushBooleanToObjectVariable':
    'pushBooleanToObjectVariable',
  'action|BuiltinVariables|||PushNumber': 'pushNumber',
  'action|BuiltinObject|||PushNumberToObjectVariable':
    'pushNumberToObjectVariable',
  'action|BuiltinScene|||PushScene': 'pushScene',
  'action|BuiltinVariables|||PushString': 'pushString',
  'action|BuiltinObject|||PushStringToObjectVariable':
    'pushStringToObjectVariable',
  'action|BuiltinVariables|||PushVariable': 'pushVariable',
  'action|BuiltinObject|||PutAroundObject': 'putAroundObject',
  'action|BuiltinObject|||PutAroundPosition': 'putAroundPosition',
  'action|BuiltinScene|||Quit': 'quit',
  'action|BuiltinAudio|||RePlayMusicCanal': 'rePlayMusicCanal',
  'action|BuiltinAudio|||RePlaySoundCanal': 'rePlaySoundCanal',
  'action|BuiltinFile|||ReadNumberFromStorage': 'readNumberFromStorage',
  'action|BuiltinFile|||ReadStringFromStorage': 'readStringFromStorage',
  'action|BuiltinObject|||Rebondir': 'rebondir',
  'action|BuiltinObject|||RemoveObjectTimer': 'removeObjectTimer',
  'action|BuiltinTime|||RemoveTimer': 'removeTimer',
  'action|BuiltinVariables|||RemoveVariableAt': 'removeVariableAt',
  'action|BuiltinVariables|||RemoveVariableChild': 'removeVariableChild',
  'action|BuiltinObject|||ResetObjectTimer': 'resetObjectTimer',
  'action|BuiltinTime|||ResetTimer': 'resetTimer',
  'action|ResizableCapability||ResizableCapability::ResizableBehavior|ResizableCapability::ResizableBehavior::SetHeight':
    'resizableCapabilitySetHeight',
  'action|ResizableCapability||ResizableCapability::ResizableBehavior|ResizableCapability::ResizableBehavior::SetSize':
    'resizableCapabilitySetSize',
  'action|ResizableCapability||ResizableCapability::ResizableBehavior|ResizableCapability::ResizableBehavior::SetWidth':
    'resizableCapabilitySetWidth',
  'action|BuiltinAudio|||ResumeMusicChannel': 'resumeMusicChannel',
  'action|BuiltinAudio|||ResumeSoundChannel': 'resumeSoundChannel',
  'action|BuiltinObject|||Rotate': 'rotate',
  'action|BuiltinCamera|||RotateCamera': 'rotateCamera',
  'action|BuiltinObject|||RotateTowardAngle': 'rotateTowardAngle',
  'action|BuiltinObject|||RotateTowardObject': 'rotateTowardObject',
  'action|BuiltinObject|||RotateTowardPosition': 'rotateTowardPosition',
  'action|SaveState|||SaveState::CheckSaveExistsInStorage':
    'checkSaveExistsInStorage',
  'action|SaveState|||SaveState::CreateGameSaveStateInStorage':
    'createGameSaveStateInStorage',
  'action|SaveState|||SaveState::CreateGameSaveStateInVariable':
    'createGameSaveStateInVariable',
  'action|SaveState|||SaveState::DeleteSaveFromStorage':
    'deleteSaveFromStorage',
  'action|SaveState|||SaveState::DuplicateSaveInStorage':
    'duplicateSaveInStorage',
  'action|SaveState|||SaveState::ListSavesInVariable': 'listSavesInVariable',
  'action|SaveState|||SaveState::RestoreGameSaveStateFromStorage':
    'restoreGameSaveStateFromStorage',
  'action|SaveState|||SaveState::RestoreGameSaveStateFromVariable':
    'restoreGameSaveStateFromVariable',
  'action|SaveState|||SaveState::SetGameDataSaveConfiguration':
    'setGameDataSaveConfiguration',
  'action|SaveState|||SaveState::SetSceneDataSaveConfiguration':
    'setSceneDataSaveConfiguration',
  'action|SaveState|||SaveState::SetVariableSaveConfiguration':
    'setVariableSaveConfiguration',
  'action|ScalableCapability||ScalableCapability::ScalableBehavior|ScalableCapability::ScalableBehavior::SetValue':
    'scalableCapabilitySetValue',
  'action|ScalableCapability||ScalableCapability::ScalableBehavior|ScalableCapability::ScalableBehavior::SetX':
    'scalableCapabilitySetX',
  'action|ScalableCapability||ScalableCapability::ScalableBehavior|ScalableCapability::ScalableBehavior::SetY':
    'scalableCapabilitySetY',
  'action|BuiltinScene|||Scene': 'scene',
  'action|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::FlipZ':
    'scene3DFlipZ',
  'action|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::SetCenterZ':
    'setCenterZ',
  'action|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::SetDepth':
    'scene3DSetDepth',
  'action|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::SetRotationX':
    'scene3DSetRotationX',
  'action|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::SetRotationY':
    'scene3DSetRotationY',
  'action|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::SetScaleZ':
    'scene3DSetScaleZ',
  'action|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::SetZ':
    'scene3DSetZ',
  'action|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::TurnAroundX':
    'scene3DTurnAroundX',
  'action|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::TurnAroundY':
    'scene3DTurnAroundY',
  'action|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::TurnAroundZ':
    'scene3DTurnAroundZ',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::FlipX':
    'scene3DFlipX',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::FlipY':
    'scene3DFlipY',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::FlipZ':
    'scene3DCube3DObjectFlipZ',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::Scale':
    'scene3DScale',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::SetDepth':
    'scene3DCube3DObjectSetDepth',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::SetFaceResource':
    'setFaceResource',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::SetFaceVisibility':
    'setFaceVisibility',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::SetHeight':
    'scene3DSetHeight',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::SetRotationX':
    'scene3DCube3DObjectSetRotationX',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::SetRotationY':
    'scene3DCube3DObjectSetRotationY',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::SetScaleX':
    'scene3DSetScaleX',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::SetScaleY':
    'scene3DSetScaleY',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::SetScaleZ':
    'scene3DCube3DObjectSetScaleZ',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::SetTint':
    'scene3DSetTint',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::SetWidth':
    'scene3DSetWidth',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::SetZ':
    'scene3DCube3DObjectSetZ',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::TurnAroundX':
    'scene3DCube3DObjectTurnAroundX',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::TurnAroundY':
    'scene3DCube3DObjectTurnAroundY',
  'action|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::TurnAroundZ':
    'scene3DCube3DObjectTurnAroundZ',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::FlipX':
    'scene3DModel3DObjectFlipX',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::FlipY':
    'scene3DModel3DObjectFlipY',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::FlipZ':
    'scene3DModel3DObjectFlipZ',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::Scale':
    'scene3DModel3DObjectScale',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::SetAnimation':
    'scene3DSetAnimation',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::SetAnimationName':
    'scene3DSetAnimationName',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::SetAnimationSpeedScale':
    'scene3DSetAnimationSpeedScale',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::SetCrossfadeDuration':
    'setCrossfadeDuration',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::SetDepth':
    'scene3DModel3DObjectSetDepth',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::SetHeight':
    'scene3DModel3DObjectSetHeight',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::SetRotationX':
    'scene3DModel3DObjectSetRotationX',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::SetRotationY':
    'scene3DModel3DObjectSetRotationY',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::SetScaleX':
    'scene3DModel3DObjectSetScaleX',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::SetScaleY':
    'scene3DModel3DObjectSetScaleY',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::SetScaleZ':
    'scene3DModel3DObjectSetScaleZ',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::SetWidth':
    'scene3DModel3DObjectSetWidth',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::SetZ':
    'scene3DModel3DObjectSetZ',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::TurnAroundX':
    'scene3DModel3DObjectTurnAroundX',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::TurnAroundY':
    'scene3DModel3DObjectTurnAroundY',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::TurnAroundZ':
    'scene3DModel3DObjectTurnAroundZ',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::PauseAnimation':
    'scene3DPauseAnimation',
  'action|Scene3D|Scene3D::Model3DObject||Scene3D::ResumeAnimation':
    'resumeAnimation',
  'action|Scene3D|||Scene3D::SetCameraFarPlane': 'setCameraFarPlane',
  'action|Scene3D|||Scene3D::SetCameraFov': 'setCameraFov',
  'action|Scene3D|||Scene3D::SetCameraNearPlane': 'setCameraNearPlane',
  'action|Scene3D|||Scene3D::SetCameraRotationX': 'setCameraRotationX',
  'action|Scene3D|||Scene3D::SetCameraRotationY': 'setCameraRotationY',
  'action|Scene3D|||Scene3D::SetCameraZ': 'setCameraZ',
  'action|Scene3D|||Scene3D::TurnCameraTowardObject': 'turnCameraTowardObject',
  'action|Scene3D|||Scene3D::TurnCameraTowardPosition':
    'turnCameraTowardPosition',
  'action|BuiltinScene|||SceneBackground': 'sceneBackground',
  'action|BuiltinVariables|||SceneVariablePush': 'sceneVariablePush',
  'action|BuiltinVariables|||SceneVariablePushBool': 'sceneVariablePushBool',
  'action|BuiltinVariables|||SceneVariablePushNumber':
    'sceneVariablePushNumber',
  'action|BuiltinVariables|||SceneVariablePushString':
    'sceneVariablePushString',
  'action|BuiltinVariables|||SceneVariableRemoveAt': 'sceneVariableRemoveAt',
  'action|Screenshot|||Screenshot::TakeScreenshot': 'takeScreenshot',
  'action|BuiltinNetwork|||SendAsyncRequest': 'sendAsyncRequest',
  'action|BuiltinNetwork|||SendRequest': 'sendRequest',
  'action|BuiltinObject|||SeparateFromObjects': 'separateFromObjects',
  'action|BuiltinWindow|||SetAdaptGameResolutionAtRuntime':
    'setAdaptGameResolutionAtRuntime',
  'action|BuiltinObject|||SetAngle': 'setAngle',
  'action|Sprite|Sprite||SetAnimationName': 'spriteSetAnimationName',
  'action|BuiltinObject|||SetBooleanObjectVariable': 'setBooleanObjectVariable',
  'action|BuiltinVariables|||SetBooleanVariable': 'setBooleanVariable',
  'action|BuiltinCamera|||SetCameraAngle': 'setCameraAngle',
  'action|BuiltinCamera|||SetCameraCenterX': 'setCameraCenterX',
  'action|BuiltinCamera|||SetCameraCenterY': 'setCameraCenterY',
  'action|BuiltinCamera|||SetCameraX': 'setCameraX',
  'action|BuiltinCamera|||SetCameraY': 'setCameraY',
  'action|BuiltinObject|||SetCenter': 'setCenter',
  'action|BuiltinObject|||SetCenterX': 'setCenterX',
  'action|BuiltinObject|||SetCenterY': 'setCenterY',
  'action|BuiltinObject|||SetEffectBooleanParameter':
    'objectSetEffectBooleanParameter',
  'action|BuiltinObject|||SetEffectDoubleParameter':
    'objectSetEffectDoubleParameter',
  'action|BuiltinObject|||SetEffectStringParameter':
    'objectSetEffectStringParameter',
  'action|BuiltinWindow|||SetFullScreen': 'setFullScreen',
  'action|BuiltinWindow|||SetGameResolutionResizeMode':
    'setGameResolutionResizeMode',
  'action|BuiltinWindow|||SetGameResolutionSize': 'setGameResolutionSize',
  'action|BuiltinVariables|||SetGlobalVariableAsBoolean':
    'setGlobalVariableAsBoolean',
  'action|BuiltinAudio|||SetGlobalVolume': 'setGlobalVolume',
  'action|BuiltinObject|||SetIncludedInParentCollisionMask':
    'setIncludedInParentCollisionMask',
  'action|BuiltinCamera|||SetLayerAmbientLightColor':
    'setLayerAmbientLightColor',
  'action|BuiltinCamera|||SetLayerDefaultZOrder': 'setLayerDefaultZOrder',
  'action|BuiltinCamera|||SetLayerEffectBooleanParameter':
    'setLayerEffectBooleanParameter',
  'action|BuiltinCamera|||SetLayerEffectParameter': 'setLayerEffectParameter',
  'action|BuiltinCamera|||SetLayerEffectStringParameter':
    'setLayerEffectStringParameter',
  'action|BuiltinAudio|||SetMusicChannelPitch': 'setMusicChannelPitch',
  'action|BuiltinAudio|||SetMusicChannelPlayingOffset':
    'setMusicChannelPlayingOffset',
  'action|BuiltinAudio|||SetMusicChannelVolume': 'setMusicChannelVolume',
  'action|BuiltinObject|||SetNumberObjectVariable': 'setNumberObjectVariable',
  'action|BuiltinVariables|||SetNumberVariable': 'setNumberVariable',
  'action|BuiltinObject|||SetObjectVariableAsBoolean':
    'setObjectVariableAsBoolean',
  'action|BuiltinAdvanced|||SetReturnBoolean': 'setReturnBoolean',
  'action|BuiltinAdvanced|||SetReturnNumber': 'setReturnNumber',
  'action|BuiltinAdvanced|||SetReturnString': 'setReturnString',
  'action|BuiltinVariables|||SetSceneVariableAsBoolean':
    'setSceneVariableAsBoolean',
  'action|Sprite|Sprite||SetSize': 'spriteSetSize',
  'action|BuiltinAudio|||SetSoundChannelPitch': 'setSoundChannelPitch',
  'action|BuiltinAudio|||SetSoundChannelPlayingOffset':
    'setSoundChannelPlayingOffset',
  'action|BuiltinAudio|||SetSoundChannelVolume': 'setSoundChannelVolume',
  'action|BuiltinObject|||SetStringObjectVariable': 'setStringObjectVariable',
  'action|BuiltinVariables|||SetStringVariable': 'setStringVariable',
  'action|BuiltinWindow|||SetWindowMargins': 'setWindowMargins',
  'action|BuiltinWindow|||SetWindowSize': 'setWindowSize',
  'action|BuiltinWindow|||SetWindowTitle': 'setWindowTitle',
  'action|BuiltinObject|||SetX': 'setX',
  'action|BuiltinObject|||SetXY': 'setXY',
  'action|BuiltinObject|||SetY': 'setY',
  'action|BuiltinObject|||SetZOrder': 'setZOrder',
  'action|Shopify|||Shopify::BuildClient': 'buildClient',
  'action|Shopify|||Shopify::GetCheckoutUrlForProduct':
    'getCheckoutUrlForProduct',
  'action|BuiltinObject|||Show': 'objectShow',
  'action|BuiltinMouse|||ShowCursor': 'showCursor',
  'action|BuiltinCamera|||ShowLayer': 'showLayer',
  'action|SpatialSound|||SpatialSound::SetListenerPosition':
    'setListenerPosition',
  'action|SpatialSound|||SpatialSound::SetSoundPosition': 'setSoundPosition',
  'action|SpineObject|SpineObject::SpineObject||SpineObject::SetSkin':
    'setSpineSkin',
  'action|SpineObject|SpineObject::SpineObject||SpineObject::SpineObject::SetAnimation':
    'spineObjectSetAnimation',
  'action|SpringBoneDynamics||SpringBoneDynamics::SpringBone3DBehavior|SpringBoneDynamics::NotifyTeleported':
    'notifyTeleported',
  'action|SpringBoneDynamics||SpringBoneDynamics::SpringBone3DBehavior|SpringBoneDynamics::ResetSimulation':
    'springBoneDynamicsResetSimulation',
  'action|SpringBoneDynamics||SpringBoneDynamics::SpringBone3DBehavior|SpringBoneDynamics::SetBlendWeight':
    'setBlendWeight',
  'action|SpringBoneDynamics||SpringBoneDynamics::SpringBone3DBehavior|SpringBoneDynamics::SetGravityScale':
    'springBoneDynamicsSetGravityScale',
  'action|SpringBoneDynamics||SpringBoneDynamics::SpringBone3DBehavior|SpringBoneDynamics::SetMovementInertia':
    'setMovementInertia',
  'action|SpringBoneDynamics||SpringBoneDynamics::SpringBone3DBehavior|SpringBoneDynamics::SetRotationInertia':
    'setRotationInertia',
  'action|SpringBoneDynamics||SpringBoneDynamics::SpringBone3DBehavior|SpringBoneDynamics::SetSimulationEnabled':
    'springBoneDynamicsSetSimulationEnabled',
  'action|SpringBoneDynamics||SpringBoneDynamics::SpringBone3DBehavior|SpringBoneDynamics::SetWind':
    'springBoneDynamicsSetWind',
  'action|Steamworks|||Steamworks::ActivateActionSet': 'activateActionSet',
  'action|Steamworks|||Steamworks::ClaimAchievement': 'claimAchievement',
  'action|Steamworks|||Steamworks::CreateLobby': 'createLobby',
  'action|Steamworks|||Steamworks::CreateWorkshopItem': 'createWorkshopItem',
  'action|Steamworks|||Steamworks::DeleteCloudFile': 'deleteCloudFile',
  'action|Steamworks|||Steamworks::DownloadWorkshopItem':
    'downloadWorkshopItem',
  'action|Steamworks|||Steamworks::GetCurrentLobbyMembers':
    'getCurrentLobbyMembers',
  'action|Steamworks|||Steamworks::GetLobbies': 'getLobbies',
  'action|Steamworks|||Steamworks::GetLobbyMembers': 'getLobbyMembers',
  'action|Steamworks|||Steamworks::JoinLobby': 'joinLobby',
  'action|Steamworks|||Steamworks::LeaveLobby': 'leaveLobby',
  'action|Steamworks|||Steamworks::OpenInviteDialogue': 'openInviteDialogue',
  'action|Steamworks|||Steamworks::SetCurrentLobbyAttribute':
    'setCurrentLobbyAttribute',
  'action|Steamworks|||Steamworks::SetCurrentLobbyJoinability':
    'setCurrentLobbyJoinability',
  'action|Steamworks|||Steamworks::SetRichPresence': 'setRichPresence',
  'action|Steamworks|||Steamworks::SubscribeWorkshopItem':
    'subscribeWorkshopItem',
  'action|Steamworks|||Steamworks::UnclaimAchievement': 'unclaimAchievement',
  'action|Steamworks|||Steamworks::UnsubscribeWorkshopItem':
    'unsubscribeWorkshopItem',
  'action|Steamworks|||Steamworks::UpdateWorkshopItem': 'updateWorkshopItem',
  'action|Steamworks|||Steamworks::WriteCloudFile': 'writeCloudFile',
  'action|BuiltinAudio|||StopMusicCanal': 'stopMusicCanal',
  'action|BuiltinAudio|||StopMusicChannel': 'stopMusicChannel',
  'action|BuiltinAudio|||StopSoundCanal': 'stopSoundCanal',
  'action|BuiltinAudio|||StopSoundChannel': 'stopSoundChannel',
  'action|BuiltinScene|||SubscribeSceneSignal': 'subscribeSceneSignal',
  'action|SvgUI|SvgUI::SvgUIObject||SvgUI::SvgUIObject::SetNodeColor':
    'setNodeColor',
  'action|SvgUI|SvgUI::SvgUIObject||SvgUI::SvgUIObject::SetNodeText':
    'setNodeText',
  'action|SvgUI|SvgUI::SvgUIObject||SvgUI::SvgUIObject::SetNodeVisible':
    'setNodeVisible',
  'action|SvgUI|SvgUI::SvgUIObject||SvgUI::SvgUIObject::SetNodeWidth':
    'setNodeWidth',
  'action|TSLMaterial||TSLMaterial::Material|TSLMaterial::ApplyMaterial':
    'applyTSLMaterial',
  'action|TSLMaterial||TSLMaterial::Material|TSLMaterial::EnableBinding':
    'enableBinding',
  'action|TSLMaterial||TSLMaterial::Material|TSLMaterial::RemoveAllBindings':
    'removeAllBindings',
  'action|TSLMaterial||TSLMaterial::Material|TSLMaterial::RemoveBinding':
    'removeBinding',
  'action|TSLMaterial||TSLMaterial::Material|TSLMaterial::ResetParameter':
    'resetMaterialParameter',
  'action|TSLMaterial||TSLMaterial::Material|TSLMaterial::SetBooleanParameter':
    'setMaterialBooleanParameter',
  'action|TSLMaterial||TSLMaterial::Material|TSLMaterial::SetColorParameter':
    'setMaterialColorParameter',
  'action|TSLMaterial||TSLMaterial::Material|TSLMaterial::SetNumberParameter':
    'setMaterialNumberParameter',
  'action|TSLMaterial||TSLMaterial::Material|TSLMaterial::SetTextureParameter':
    'setMaterialTextureParameter',
  'action|TSLMaterial||TSLMaterial::Material|TSLMaterial::SetVector2Parameter':
    'setMaterialVector2Parameter',
  'action|TSLMaterial||TSLMaterial::Material|TSLMaterial::SetVector3Parameter':
    'setMaterialVector3Parameter',
  'action|TSLMaterial||TSLMaterial::Material|TSLMaterial::SetVector4Parameter':
    'setMaterialVector4Parameter',
  'action|TextContainerCapability||TextContainerCapability::TextContainerBehavior|TextContainerCapability::TextContainerBehavior::SetValue':
    'setTextValue',
  'action|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::Focus':
    'textInputFocus',
  'action|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::SetBorderColor':
    'setBorderColor',
  'action|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::SetBorderOpacity':
    'setBorderOpacity',
  'action|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::SetBorderWidth':
    'setBorderWidth',
  'action|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::SetDisabled':
    'setDisabled',
  'action|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::SetFillColor':
    'setFillColor',
  'action|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::SetFillOpacity':
    'setFillOpacity',
  'action|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::SetFont size':
    'setFontsize',
  'action|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::SetFontResourceName':
    'setFontResourceName',
  'action|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::SetInputType':
    'setInputType',
  'action|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::SetOpacity':
    'textInputSetOpacity',
  'action|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::SetPlaceholder':
    'setPlaceholder',
  'action|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::SetReadOnly':
    'setReadOnly',
  'action|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::SetSpellCheck':
    'setSpellCheck',
  'action|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::SetText':
    'textInputSetText',
  'action|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::SetTextColor':
    'setTextColor',
  'action|TextObject|TextObject::Text||TextObject::Angle': 'textObjectAngle',
  'action|TextObject|TextObject::Text||TextObject::ChangeColor':
    'textObjectChangeColor',
  'action|TextObject|TextObject::Text||TextObject::Font': 'font',
  'action|TextObject|TextObject::Text||TextObject::Opacity':
    'textObjectOpacity',
  'action|TextObject|TextObject::Text||TextObject::Scale': 'textObjectScale',
  'action|TextObject|TextObject::Text||TextObject::ScaleX': 'scaleX',
  'action|TextObject|TextObject::Text||TextObject::ScaleY': 'scaleY',
  'action|TextObject|TextObject::Text||TextObject::SetBold': 'setBold',
  'action|TextObject|TextObject::Text||TextObject::SetGradient': 'setGradient',
  'action|TextObject|TextObject::Text||TextObject::SetItalic': 'setItalic',
  'action|TextObject|TextObject::Text||TextObject::SetOutline': 'setOutline',
  'action|TextObject|TextObject::Text||TextObject::SetPadding': 'setPadding',
  'action|TextObject|TextObject::Text||TextObject::SetShadow': 'setShadow',
  'action|TextObject|TextObject::Text||TextObject::SetTextAlignment':
    'setTextAlignment',
  'action|TextObject|TextObject::Text||TextObject::SetWrapping': 'setWrapping',
  'action|TextObject|TextObject::Text||TextObject::ShowShadow': 'showShadow',
  'action|TextObject|TextObject::Text||TextObject::Size': 'size',
  'action|TextObject|TextObject::Text||TextObject::String': 'updateText',
  'action|TextObject|TextObject::Text||TextObject::Text::SetFontSize':
    'textObjectSetFontSize',
  'action|TextObject|TextObject::Text||TextObject::Text::SetLineHeight':
    'setLineHeight',
  'action|TextObject|TextObject::Text||TextObject::Text::SetOutlineColor':
    'setOutlineColor',
  'action|TextObject|TextObject::Text||TextObject::Text::SetOutlineEnabled':
    'setOutlineEnabled',
  'action|TextObject|TextObject::Text||TextObject::Text::SetOutlineThickness':
    'setOutlineThickness',
  'action|TextObject|TextObject::Text||TextObject::Text::SetShadowAngle':
    'setShadowAngle',
  'action|TextObject|TextObject::Text||TextObject::Text::SetShadowBlurRadius':
    'setShadowBlurRadius',
  'action|TextObject|TextObject::Text||TextObject::Text::SetShadowColor':
    'setShadowColor',
  'action|TextObject|TextObject::Text||TextObject::Text::SetShadowDistance':
    'setShadowDistance',
  'action|TextObject|TextObject::Text||TextObject::Text::SetShadowOpacity':
    'setShadowOpacity',
  'action|TextObject|TextObject::Text||TextObject::WrappingWidth':
    'wrappingWidth',
  'action|TileMap|TileMap::CollisionMask||TileMap::CollisionMask::Height':
    'tileMapHeight',
  'action|TileMap|TileMap::CollisionMask||TileMap::CollisionMask::Scale':
    'tileMapScale',
  'action|TileMap|TileMap::CollisionMask||TileMap::CollisionMask::SetScaleX':
    'tileMapSetScaleX',
  'action|TileMap|TileMap::CollisionMask||TileMap::CollisionMask::SetScaleY':
    'tileMapSetScaleY',
  'action|TileMap|TileMap::CollisionMask||TileMap::CollisionMask::SetTilemapJsonFile':
    'tileMapSetTilemapJsonFile',
  'action|TileMap|TileMap::CollisionMask||TileMap::CollisionMask::SetTilesetJsonFile':
    'tileMapSetTilesetJsonFile',
  'action|TileMap|TileMap::CollisionMask||TileMap::CollisionMask::Width':
    'tileMapWidth',
  'action|TileMap|TileMap::SimpleTileMap||TileMap::FlipTileOnXAtGridCoordinates':
    'tileMapFlipTileOnXAtGridCoordinates',
  'action|TileMap|TileMap::SimpleTileMap||TileMap::FlipTileOnXAtPosition':
    'tileMapFlipTileOnXAtPosition',
  'action|TileMap|TileMap::SimpleTileMap||TileMap::FlipTileOnYAtGridCoordinates':
    'tileMapFlipTileOnYAtGridCoordinates',
  'action|TileMap|TileMap::SimpleTileMap||TileMap::FlipTileOnYAtPosition':
    'tileMapFlipTileOnYAtPosition',
  'action|TileMap|TileMap::TileMap||TileMap::Height': 'tileMapTileMapHeight',
  'action|TileMap|TileMap::SimpleTileMap||TileMap::RemoveTileAtGridCoordinates':
    'tileMapRemoveTileAtGridCoordinates',
  'action|TileMap|TileMap::SimpleTileMap||TileMap::RemoveTileAtPosition':
    'tileMapRemoveTileAtPosition',
  'action|TileMap|TileMap::TileMap||TileMap::Scale': 'tileMapTileMapScale',
  'action|TileMap|TileMap::TileMap||TileMap::SetAnimationFps':
    'setAnimationFps',
  'action|TileMap|TileMap::TileMap||TileMap::SetAnimationSpeedScale':
    'tileMapSetAnimationSpeedScale',
  'action|TileMap|TileMap::TileMap||TileMap::SetDisplayMode': 'setDisplayMode',
  'action|TileMap|TileMap::TileMap||TileMap::SetLayerIndex': 'setLayerIndex',
  'action|TileMap|TileMap::TileMap||TileMap::SetTilemapJsonFile':
    'tileMapTileMapSetTilemapJsonFile',
  'action|TileMap|TileMap::TileMap||TileMap::SetTilesetJsonFile':
    'tileMapTileMapSetTilesetJsonFile',
  'action|TileMap|TileMap::SimpleTileMap||TileMap::SimpleTileMap::SetGridColumnCount':
    'tileMapSetGridColumnCount',
  'action|TileMap|TileMap::SimpleTileMap||TileMap::SimpleTileMap::SetGridRowCount':
    'tileMapSetGridRowCount',
  'action|TileMap|TileMap::SimpleTileMap||TileMap::SimpleTileMap::SetTileIdAtGrid':
    'tileMapSetTileIdAtGrid',
  'action|TileMap|TileMap::SimpleTileMap||TileMap::SimpleTileMap::SetTileIdAtPosition':
    'tileMapSetTileIdAtPosition',
  'action|TileMap|TileMap::TileMap||TileMap::TileMap::SetScaleX':
    'tileMapTileMapSetScaleX',
  'action|TileMap|TileMap::TileMap||TileMap::TileMap::SetScaleY':
    'tileMapTileMapSetScaleY',
  'action|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::FlipTileOnXAtGridCoordinates':
    'tileMapTileMapBehaviorFlipTileOnXAtGridCoordinates',
  'action|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::FlipTileOnXAtPosition':
    'tileMapTileMapBehaviorFlipTileOnXAtPosition',
  'action|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::FlipTileOnYAtGridCoordinates':
    'tileMapTileMapBehaviorFlipTileOnYAtGridCoordinates',
  'action|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::FlipTileOnYAtPosition':
    'tileMapTileMapBehaviorFlipTileOnYAtPosition',
  'action|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::RemoveTileAtGridCoordinates':
    'tileMapTileMapBehaviorRemoveTileAtGridCoordinates',
  'action|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::RemoveTileAtPosition':
    'tileMapTileMapBehaviorRemoveTileAtPosition',
  'action|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::SetGridColumnCount':
    'tileMapTileMapBehaviorSetGridColumnCount',
  'action|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::SetGridRowCount':
    'tileMapTileMapBehaviorSetGridRowCount',
  'action|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::SetTileIdAtGrid':
    'tileMapTileMapBehaviorSetTileIdAtGrid',
  'action|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::SetTileIdAtPosition':
    'tileMapTileMapBehaviorSetTileIdAtPosition',
  'action|TileMap|TileMap::TileMap||TileMap::Width': 'tileMapTileMapWidth',
  'action|TiledSpriteObject|TiledSpriteObject::TiledSprite||TiledSpriteObject::Angle':
    'tiledSpriteObjectAngle',
  'action|TiledSpriteObject|TiledSpriteObject::TiledSprite||TiledSpriteObject::Height':
    'tiledSpriteObjectHeight',
  'action|TiledSpriteObject|TiledSpriteObject::TiledSprite||TiledSpriteObject::SetColor':
    'tiledSpriteObjectSetColor',
  'action|TiledSpriteObject|TiledSpriteObject::TiledSprite||TiledSpriteObject::SetImageFromResource':
    'tiledSpriteObjectSetImageFromResource',
  'action|TiledSpriteObject|TiledSpriteObject::TiledSprite||TiledSpriteObject::SetOpacity':
    'tiledSpriteObjectSetOpacity',
  'action|TiledSpriteObject|TiledSpriteObject::TiledSprite||TiledSpriteObject::SetSize':
    'tiledSpriteObjectSetSize',
  'action|TiledSpriteObject|TiledSpriteObject::TiledSprite||TiledSpriteObject::Width':
    'tiledSpriteObjectWidth',
  'action|TiledSpriteObject|TiledSpriteObject::TiledSprite||TiledSpriteObject::XOffset':
    'xOffset',
  'action|TiledSpriteObject|TiledSpriteObject::TiledSprite||TiledSpriteObject::YOffset':
    'yOffset',
  'action|BuiltinVariables|||ToggleGlobalVariableAsBoolean':
    'toggleGlobalVariableAsBoolean',
  'action|BuiltinObject|||ToggleObjectVariableAsBoolean':
    'toggleObjectVariableAsBoolean',
  'action|BuiltinVariables|||ToggleSceneVariableAsBoolean':
    'toggleSceneVariableAsBoolean',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::Acceleration':
    'topDownMovementBehaviorAcceleration',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::AllowDiagonals':
    'topDownMovementBehaviorAllowDiagonals',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::AngleOffset':
    'topDownMovementBehaviorAngleOffset',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::AngularMaxSpeed':
    'topDownMovementBehaviorAngularMaxSpeed',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::Deceleration':
    'topDownMovementBehaviorDeceleration',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::IgnoreDefaultControls':
    'topDownMovementBehaviorIgnoreDefaultControls',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::MaxSpeed':
    'topDownMovementBehaviorMaxSpeed',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::RotateObject':
    'topDownMovementBehaviorRotateObject',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::SimulateControl':
    'topDownMovementBehaviorSimulateControl',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::SimulateDownKey':
    'topDownMovementBehaviorSimulateDownKey',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::SimulateLeftKey':
    'topDownMovementBehaviorSimulateLeftKey',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::SimulateRightKey':
    'topDownMovementBehaviorSimulateRightKey',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::SimulateStick':
    'topDownMovementBehaviorSimulateStick',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::SimulateUpKey':
    'topDownMovementBehaviorSimulateUpKey',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::TopDownMovementBehavior::SetMovementAngleOffset':
    'setMovementAngleOffset',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::TopDownMovementBehavior::SetVelocityX':
    'setVelocityX',
  'action|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::TopDownMovementBehavior::SetVelocityY':
    'setVelocityY',
  'action|BuiltinMouse|||TouchSimulateMouse': 'touchSimulateMouse',
  'action|Sprite|Sprite||TourneVers': 'tourneVers',
  'action|Sprite|Sprite||TourneVersPos': 'tourneVersPos',
  'action|Tween|||Tween::AddLayerValueTween': 'addLayerValueTween',
  'action|Tween|||Tween::AddLayoutValueTween': 'addLayoutValueTween',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectAngleTween':
    'addObjectAngleTween',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectColorHSLTween':
    'addObjectColorHSLTween',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectColorTween':
    'addObjectColorTween',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectDepthTween':
    'addObjectDepthTween',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectDepthTween2':
    'addObjectDepthTween2',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectHeightTween':
    'addObjectHeightTween',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectOpacityTween':
    'addObjectOpacityTween',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectPositionTween':
    'addObjectPositionTween',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectPositionXTween':
    'addObjectPositionXTween',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectPositionYTween':
    'addObjectPositionYTween',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectPositionZTween':
    'addObjectPositionZTween',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectPositionZTween2':
    'addObjectPositionZTween2',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectScaleTween':
    'addObjectScaleTween',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectScaleXTween':
    'addObjectScaleXTween',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectScaleYTween':
    'addObjectScaleYTween',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectVariableTween':
    'addObjectVariableTween',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectVariableTween2':
    'addObjectVariableTween2',
  'action|Tween||Tween::TweenBehavior|Tween::AddObjectWidthTween':
    'addObjectWidthTween',
  'action|Tween||Tween::TweenBehavior|Tween::AddTextObjectCharacterSizeTween':
    'addTextObjectCharacterSizeTween',
  'action|Tween|||Tween::PauseSceneTween': 'pauseSceneTween',
  'action|Tween||Tween::TweenBehavior|Tween::PauseTween': 'pauseTween',
  'action|Tween|||Tween::RemoveSceneTween': 'removeSceneTween',
  'action|Tween||Tween::TweenBehavior|Tween::RemoveTween': 'removeTween',
  'action|Tween|||Tween::ResumeSceneTween': 'resumeSceneTween',
  'action|Tween||Tween::TweenBehavior|Tween::ResumeTween': 'resumeTween',
  'action|Tween|||Tween::StopSceneTween': 'stopSceneTween',
  'action|Tween||Tween::TweenBehavior|Tween::StopTween': 'stopTween',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddColorEffectPropertyTween':
    'addColorEffectPropertyTween',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddNumberEffectPropertyTween':
    'addNumberEffectPropertyTween',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectAngleTween2':
    'addObjectAngleTween2',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectColorHSLTween2':
    'addObjectColorHSLTween2',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectColorTween2':
    'addObjectColorTween2',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectHeightTween2':
    'addObjectHeightTween2',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectOpacityTween2':
    'addObjectOpacityTween2',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectOpacityTween3':
    'addObjectOpacityTween3',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectPositionTween2':
    'addObjectPositionTween2',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectPositionXTween2':
    'addObjectPositionXTween2',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectPositionYTween2':
    'addObjectPositionYTween2',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectRotationXTween':
    'addObjectRotationXTween',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectRotationYTween':
    'addObjectRotationYTween',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectScaleTween2':
    'addObjectScaleTween2',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectScaleTween3':
    'addObjectScaleTween3',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectScaleXTween2':
    'addObjectScaleXTween2',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectScaleYTween2':
    'addObjectScaleYTween2',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectValueTween':
    'addObjectValueTween',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectVariableTween3':
    'addObjectVariableTween3',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddObjectWidthTween2':
    'addObjectWidthTween2',
  'action|Tween||Tween::TweenBehavior|Tween::TweenBehavior::AddTextObjectCharacterSizeTween2':
    'addTextObjectCharacterSizeTween2',
  'action|Tween|||Tween::TweenCameraPosition': 'tweenCameraPosition',
  'action|Tween|||Tween::TweenCameraPosition2': 'tweenCameraPosition2',
  'action|Tween|||Tween::TweenCameraRotation': 'tweenCameraRotation',
  'action|Tween|||Tween::TweenCameraRotation2': 'tweenCameraRotation2',
  'action|Tween|||Tween::TweenCameraZ': 'tweenCameraZ',
  'action|Tween|||Tween::TweenCameraZoom': 'tweenCameraZoom',
  'action|Tween|||Tween::TweenCameraZoom2': 'tweenCameraZoom2',
  'action|Tween|||Tween::TweenColorEffectPropertyTween':
    'tweenColorEffectPropertyTween',
  'action|Tween|||Tween::TweenNumberEffectPropertyTween':
    'tweenNumberEffectPropertyTween',
  'action|Tween|||Tween::TweenSceneVariableNumber': 'tweenSceneVariableNumber',
  'action|Tween|||Tween::TweenSceneVariableNumber2':
    'tweenSceneVariableNumber2',
  'action|Tween|||Tween::TweenSceneVariableNumber3':
    'tweenSceneVariableNumber3',
  'action|BuiltinObject|||UnPauseObjectTimer': 'unPauseObjectTimer',
  'action|BuiltinTime|||UnPauseTimer': 'unPauseTimer',
  'action|BuiltinAudio|||UnloadAllAudio': 'unloadAllAudio',
  'action|BuiltinFile|||UnloadFile': 'unloadFile',
  'action|BuiltinAudio|||UnloadMusic': 'unloadMusic',
  'action|BuiltinScene|||UnloadObjectAssets': 'unloadObjectAssets',
  'action|BuiltinAudio|||UnloadSound': 'unloadSound',
  'action|BuiltinVariables|||VariableClearChildren': 'variableClearChildren',
  'action|BuiltinVariables|||VariableRemoveChild': 'variableRemoveChild',
  'action|Video|Video::VideoObject||Video::Loop': 'setVideoLoop',
  'action|Video|Video::VideoObject||Video::Mute': 'setVideoMuted',
  'action|Video|Video::VideoObject||Video::Pause': 'videoPause',
  'action|Video|Video::VideoObject||Video::Play': 'videoPlay',
  'action|Video|Video::VideoObject||Video::SetOpacity': 'videoSetOpacity',
  'action|Video|Video::VideoObject||Video::SetPlaybackSpeed':
    'setVideoPlaybackSpeed',
  'action|Video|Video::VideoObject||Video::SetTime': 'setVideoTime',
  'action|Video|Video::VideoObject||Video::SetVolume': 'setVideoVolume',
  'action|BuiltinTime|||Wait': 'wait',
  'action|BuiltinCamera|||ZoomCamera': 'zoomCamera',
  'condition|AdMob|||AdMob::AdmobInitialized': 'admobInitialized',
  'condition|AdMob|||AdMob::AdmobInitializing': 'admobInitializing',
  'condition|AdMob|||AdMob::AppOpenErrored': 'appOpenErrored',
  'condition|AdMob|||AdMob::AppOpenLoading': 'appOpenLoading',
  'condition|AdMob|||AdMob::AppOpenReady': 'appOpenReady',
  'condition|AdMob|||AdMob::AppOpenShowing': 'appOpenShowing',
  'condition|AdMob|||AdMob::BannerConfigured': 'bannerConfigured',
  'condition|AdMob|||AdMob::BannerErrored': 'bannerErrored',
  'condition|AdMob|||AdMob::BannerExists': 'bannerExists',
  'condition|AdMob|||AdMob::BannerLoaded': 'bannerLoaded',
  'condition|AdMob|||AdMob::BannerReady': 'bannerReady',
  'condition|AdMob|||AdMob::BannerShowing': 'bannerShowing',
  'condition|AdMob|||AdMob::Bannerloading': 'bannerloading',
  'condition|AdMob|||AdMob::InterstitialErrored': 'interstitialErrored',
  'condition|AdMob|||AdMob::InterstitialLoading': 'interstitialLoading',
  'condition|AdMob|||AdMob::InterstitialReady': 'interstitialReady',
  'condition|AdMob|||AdMob::InterstitialShowing': 'interstitialShowing',
  'condition|AdMob|||AdMob::RewardedInterstitialErrored':
    'rewardedInterstitialErrored',
  'condition|AdMob|||AdMob::RewardedInterstitialLoading':
    'rewardedInterstitialLoading',
  'condition|AdMob|||AdMob::RewardedInterstitialReady':
    'rewardedInterstitialReady',
  'condition|AdMob|||AdMob::RewardedInterstitialRewardReceived':
    'rewardedInterstitialRewardReceived',
  'condition|AdMob|||AdMob::RewardedInterstitialShowing':
    'rewardedInterstitialShowing',
  'condition|AdMob|||AdMob::RewardedVideoErrored': 'rewardedVideoErrored',
  'condition|AdMob|||AdMob::RewardedVideoLoading': 'rewardedVideoLoading',
  'condition|AdMob|||AdMob::RewardedVideoReady': 'rewardedVideoReady',
  'condition|AdMob|||AdMob::RewardedVideoRewardReceived':
    'rewardedVideoRewardReceived',
  'condition|AdMob|||AdMob::RewardedVideoShowing': 'rewardedVideoShowing',
  'condition|AdMob|||AdMob::VideoErrored': 'videoErrored',
  'condition|AdMob|||AdMob::VideoLoading': 'videoLoading',
  'condition|AdMob|||AdMob::VideoReady': 'videoReady',
  'condition|AdMob|||AdMob::VideoReward': 'videoReward',
  'condition|AdMob|||AdMob::VideoShowing': 'videoShowing',
  'condition|AdvancedTween||AdvancedTween::AdvancedTween|AdvancedTween::AdvancedTween::CurrentTime':
    'advancedTweenCurrentTime',
  'condition|AdvancedTween||AdvancedTween::AdvancedTween|AdvancedTween::AdvancedTween::Duration':
    'advancedTweenDuration',
  'condition|AdvancedWindow|||AdvancedWindow::HasShadow': 'hasShadow',
  'condition|AdvancedWindow|||AdvancedWindow::IsAlwaysOnTop': 'isAlwaysOnTop',
  'condition|AdvancedWindow|||AdvancedWindow::IsClosable': 'isClosable',
  'condition|AdvancedWindow|||AdvancedWindow::IsFocused': 'isFocused',
  'condition|AdvancedWindow|||AdvancedWindow::IsFullScreenable':
    'isFullScreenable',
  'condition|AdvancedWindow|||AdvancedWindow::IsKiosk': 'isKiosk',
  'condition|AdvancedWindow|||AdvancedWindow::IsMaximizable': 'isMaximizable',
  'condition|AdvancedWindow|||AdvancedWindow::IsMaximized': 'isMaximized',
  'condition|AdvancedWindow|||AdvancedWindow::IsMinimizable': 'isMinimizable',
  'condition|AdvancedWindow|||AdvancedWindow::IsMinimized': 'isMinimized',
  'condition|AdvancedWindow|||AdvancedWindow::IsMovable': 'isMovable',
  'condition|AdvancedWindow|||AdvancedWindow::IsResizable': 'isResizable',
  'condition|AdvancedWindow|||AdvancedWindow::IsVisible': 'isVisible',
  'condition|AdvancedWindow|||AdvancedWindow::IsWindowEnabled':
    'isWindowEnabled',
  'condition|BuiltinObject|||AjoutHasard': 'ajoutHasard',
  'condition|BuiltinObject|||AjoutObjConcern': 'ajoutObjConcern',
  'condition|BuiltinObject|||Angle': 'objectAngle',
  'condition|BuiltinObject|||AngleOfDisplacement': 'angleOfDisplacement',
  'condition|Sprite|Sprite||AnimStopped': 'animStopped',
  'condition|AnimatableCapability||AnimatableCapability::AnimatableBehavior|AnimatableCapability::AnimatableBehavior::ElapsedTime':
    'animationElapsedTime',
  'condition|AnimatableCapability||AnimatableCapability::AnimatableBehavior|AnimatableCapability::AnimatableBehavior::HasAnimationEnded':
    'hasAnimationEnded',
  'condition|AnimatableCapability||AnimatableCapability::AnimatableBehavior|AnimatableCapability::AnimatableBehavior::Index':
    'animationIndex',
  'condition|AnimatableCapability||AnimatableCapability::AnimatableBehavior|AnimatableCapability::AnimatableBehavior::IsAnimationPaused':
    'isAnimationPaused',
  'condition|AnimatableCapability||AnimatableCapability::AnimatableBehavior|AnimatableCapability::AnimatableBehavior::Name':
    'animationName',
  'condition|AnimatableCapability||AnimatableCapability::AnimatableBehavior|AnimatableCapability::AnimatableBehavior::SpeedScale':
    'animationSpeedScale',
  'condition|Sprite|Sprite||Animation': 'spriteAnimation',
  'condition|Sprite|Sprite||AnimationEnded': 'animationEnded',
  'condition|Sprite|Sprite||AnimationEnded2': 'animationEnded2',
  'condition|Sprite|Sprite||AnimationName': 'spriteAnimationName',
  'condition|BuiltinKeyboard|||AnyKeyPressed': 'anyKeyPressed',
  'condition|BuiltinKeyboard|||AnyKeyReleased': 'anyKeyReleased',
  'condition|BuiltinScene|||AreObjectAssetsLoaded': 'areObjectAssetsLoaded',
  'condition|BuiltinScene|||AreSceneAssetsLoaded': 'areSceneAssetsLoaded',
  'condition|BuiltinObject|||Arret': 'arret',
  'condition|BBText|BBText::BBText||BBText::IsAlignment': 'isAlignment',
  'condition|BBText|BBText::BBText||BBText::IsBBText': 'isBBText',
  'condition|BBText|BBText::BBText||BBText::IsFontFamily': 'isFontFamily',
  'condition|BBText|BBText::BBText||BBText::IsFontSize': 'isFontSize',
  'condition|BBText|BBText::BBText||BBText::IsOpacity': 'isOpacity',
  'condition|BBText|BBText::BBText||BBText::IsWordWrap': 'isWordWrap',
  'condition|BBText|BBText::BBText||BBText::IsWrappingWidth': 'isWrappingWidth',
  'condition|BuiltinObject|||BehaviorActivated': 'behaviorActivated',
  'condition|BitmapText|BitmapText::BitmapTextObject||BitmapText::BitmapTextObject::Alignment':
    'alignment',
  'condition|BitmapText|BitmapText::BitmapTextObject||BitmapText::BitmapTextObject::FontName':
    'fontName',
  'condition|BitmapText|BitmapText::BitmapTextObject||BitmapText::BitmapTextObject::FontSize':
    'bitmapTextFontSize',
  'condition|BitmapText|BitmapText::BitmapTextObject||BitmapText::BitmapTextObject::Opacity':
    'bitmapTextOpacity',
  'condition|BitmapText|BitmapText::BitmapTextObject||BitmapText::BitmapTextObject::Scale':
    'scale',
  'condition|BitmapText|BitmapText::BitmapTextObject||BitmapText::BitmapTextObject::Text':
    'bitmapTextText',
  'condition|BitmapText|BitmapText::BitmapTextObject||BitmapText::BitmapTextObject::WrappingWidth':
    'bitmapTextWrappingWidth',
  'condition|BitmapText|BitmapText::BitmapTextObject||BitmapText::WordWrap':
    'wordWrap',
  'condition|Sprite|Sprite||BlendMode': 'blendMode',
  'condition|BuiltinObject|||BooleanObjectVariable': 'booleanObjectVariable',
  'condition|BuiltinVariables|||BooleanVariable': 'booleanVariable',
  'condition|BuiltinObject|||BoundingBoxBottom': 'boundingBoxBottom',
  'condition|BuiltinObject|||BoundingBoxCenterX': 'boundingBoxCenterX',
  'condition|BuiltinObject|||BoundingBoxCenterY': 'boundingBoxCenterY',
  'condition|BuiltinObject|||BoundingBoxLeft': 'boundingBoxLeft',
  'condition|BuiltinObject|||BoundingBoxRight': 'boundingBoxRight',
  'condition|BuiltinObject|||BoundingBoxTop': 'boundingBoxTop',
  'condition|BuiltinCommonInstructions|||BuiltinCommonInstructions::Always':
    'always',
  'condition|BuiltinCommonInstructions|||BuiltinCommonInstructions::And': 'and',
  'condition|BuiltinCommonInstructions|||BuiltinCommonInstructions::CompareNumbers':
    'compareNumbers',
  'condition|BuiltinCommonInstructions|||BuiltinCommonInstructions::CompareStrings':
    'compareStrings',
  'condition|BuiltinCommonInstructions|||BuiltinCommonInstructions::Not': 'not',
  'condition|BuiltinCommonInstructions|||BuiltinCommonInstructions::Once':
    'once',
  'condition|BuiltinCommonInstructions|||BuiltinCommonInstructions::Or': 'or',
  'condition|BuiltinCamera|||CameraAngle': 'cameraAngle',
  'condition|BuiltinCamera|||CameraBorderBottom': 'cameraBorderBottom',
  'condition|BuiltinCamera|||CameraBorderLeft': 'cameraBorderLeft',
  'condition|BuiltinCamera|||CameraBorderRight': 'cameraBorderRight',
  'condition|BuiltinCamera|||CameraBorderTop': 'cameraBorderTop',
  'condition|BuiltinCamera|||CameraCenterX': 'cameraCenterX',
  'condition|BuiltinCamera|||CameraCenterY': 'cameraCenterY',
  'condition|BuiltinCamera|||CameraHeight': 'cameraHeight',
  'condition|BuiltinCamera|||CameraWidth': 'cameraWidth',
  'condition|BuiltinCamera|||CameraX': 'cameraX',
  'condition|BuiltinCamera|||CameraY': 'cameraY',
  'condition|BuiltinCamera|||CameraZoom': 'cameraZoom',
  'condition|BuiltinObject|||CenterX': 'centerX',
  'condition|BuiltinObject|||CenterY': 'centerY',
  'condition|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::HasWebGPUFallbackOccurred':
    'clothSimulationHasWebGPUFallbackOccurred',
  'condition|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::IsBudgetPaused':
    'clothSimulationIsBudgetPaused',
  'condition|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::IsSimulationEnabled':
    'clothSimulationIsSimulationEnabled',
  'condition|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::IsSimulationRunning':
    'clothSimulationIsSimulationRunning',
  'condition|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::IsUsingWebGPU':
    'clothSimulationIsUsingWebGPU',
  'condition|ClothSimulation|ClothSimulation::Cloth3DObject||ClothSimulation::Cloth3DObject::IsVertexPinned':
    'isVertexPinned',
  'condition|Sprite|||Collision': 'spriteCollision',
  'condition|BuiltinObject|||CollisionEnter': 'collisionEnter',
  'condition|BuiltinObject|||CollisionExit': 'collisionExit',
  'condition|BuiltinObject|||CollisionNP': 'collision',
  'condition|BuiltinObject|||CollisionPoint': 'collisionPoint',
  'condition|BuiltinAdvanced|||CompareArgumentAsNumber':
    'compareArgumentAsNumber',
  'condition|BuiltinAdvanced|||CompareArgumentAsString':
    'compareArgumentAsString',
  'condition|BuiltinObject|||CompareObjectTimer': 'compareObjectTimer',
  'condition|BuiltinTime|||CompareTimer': 'compareTimer',
  'condition|BuiltinMouse|||CursorX': 'cursorX',
  'condition|BuiltinMouse|||CursorY': 'cursorY',
  'condition|BuiltinScene|||DepartScene': 'departScene',
  'condition|DestroyOutsideBehavior||DestroyOutsideBehavior::DestroyOutside|DestroyOutsideBehavior::DestroyOutside::ExtraBorder':
    'destroyOutsideBehaviorExtraBorder',
  'condition|DestroyOutsideBehavior||DestroyOutsideBehavior::DestroyOutside|DestroyOutsideBehavior::DestroyOutside::UnseenGraceDistance':
    'unseenGraceDistance',
  'condition|DestroyOutsideBehavior||DestroyOutsideBehavior::DestroyOutside|DestroyOutsideBehavior::ExtraBorder':
    'destroyOutsideBehaviorDestroyOutsideExtraBorder',
  'condition|DeviceSensors|||DeviceSensors::AccelerationX': 'accelerationX',
  'condition|DeviceSensors|||DeviceSensors::AccelerationY': 'accelerationY',
  'condition|DeviceSensors|||DeviceSensors::AccelerationZ': 'accelerationZ',
  'condition|DeviceSensors|||DeviceSensors::MotionSensorActive':
    'motionSensorActive',
  'condition|DeviceSensors|||DeviceSensors::OrientationAlpha':
    'orientationAlpha',
  'condition|DeviceSensors|||DeviceSensors::OrientationBeta': 'orientationBeta',
  'condition|DeviceSensors|||DeviceSensors::OrientationGamma':
    'orientationGamma',
  'condition|DeviceSensors|||DeviceSensors::OrientationSensorActive':
    'orientationSensorActive',
  'condition|DeviceSensors|||DeviceSensors::RotationAlpha': 'rotationAlpha',
  'condition|DeviceSensors|||DeviceSensors::RotationBeta': 'rotationBeta',
  'condition|DeviceSensors|||DeviceSensors::RotationGamma': 'rotationGamma',
  'condition|DialogueTree|||DialogueTree::CompareDialogueStateBooleanVariable':
    'compareDialogueStateBooleanVariable',
  'condition|DialogueTree|||DialogueTree::CompareDialogueStateNumberVariable':
    'compareDialogueStateNumberVariable',
  'condition|DialogueTree|||DialogueTree::CompareDialogueStateStringVariable':
    'compareDialogueStateStringVariable',
  'condition|DialogueTree|||DialogueTree::CurrentBranchContainsTag':
    'currentBranchContainsTag',
  'condition|DialogueTree|||DialogueTree::CurrentBranchTitle':
    'currentBranchTitle',
  'condition|DialogueTree|||DialogueTree::HasBranch': 'hasBranch',
  'condition|DialogueTree|||DialogueTree::HasClippedTextScrollingCompleted':
    'hasClippedTextScrollingCompleted',
  'condition|DialogueTree|||DialogueTree::HasSelectedOptionChanged':
    'hasSelectedOptionChanged',
  'condition|DialogueTree|||DialogueTree::IsCommandCalled': 'isCommandCalled',
  'condition|DialogueTree|||DialogueTree::IsDialogueLineType':
    'isDialogueLineType',
  'condition|DialogueTree|||DialogueTree::IsDialogueRunning':
    'isDialogueRunning',
  'condition|DialogueTree|||DialogueTree::WasBranchVisited': 'wasBranchVisited',
  'condition|Sprite|Sprite||Direction': 'direction',
  'condition|BuiltinObject|||Distance': 'distance',
  'condition|BuiltinObject|||Distance3D': 'distance3D',
  'condition|BuiltinScene|||DoesSceneExist': 'doesSceneExist',
  'condition|DraggableBehavior||DraggableBehavior::Draggable|DraggableBehavior::Dragged':
    'dragged',
  'condition|DraggableBehavior||DraggableBehavior::Draggable|DraggableBehavior::Dropped':
    'dropped',
  'condition|EffectCapability||EffectCapability::EffectBehavior|EffectCapability::EffectBehavior::IsEffectEnabled':
    'isEffectEnabled',
  'condition|BuiltinCommonInstructions|||Egal': 'egal',
  'condition|BuiltinObject|||EstTourne': 'estTourne',
  'condition|FacebookInstantGames|||FacebookInstantGames::AreAdsSupported':
    'areAdsSupported',
  'condition|FacebookInstantGames|||FacebookInstantGames::IsInterstitialAdReady':
    'isInterstitialAdReady',
  'condition|FacebookInstantGames|||FacebookInstantGames::IsRewardedVideoReady':
    'isRewardedVideoReady',
  'condition|FileSystem|||FileSystem::PathExists': 'pathExists',
  'condition|Firebase|||Firebase::IsEmailVerified': 'isEmailVerified',
  'condition|Firebase|||Firebase::IsSignedIn': 'isSignedIn',
  'condition|FlippableCapability||FlippableCapability::FlippableBehavior|FlippableCapability::FlippableBehavior::FlippedX':
    'flippableCapabilityFlippedX',
  'condition|FlippableCapability||FlippableCapability::FlippableBehavior|FlippableCapability::FlippableBehavior::FlippedY':
    'flippableCapabilityFlippedY',
  'condition|Sprite|Sprite||FlippedX': 'spriteFlippedX',
  'condition|Sprite|Sprite||FlippedY': 'spriteFlippedY',
  'condition|BuiltinAdvanced|||GetArgumentAsBoolean': 'getArgumentAsBoolean',
  'condition|BuiltinVariables|||GlobalVariableAsBoolean':
    'globalVariableAsBoolean',
  'condition|BuiltinVariables|||GlobalVariableChildCount':
    'globalVariableChildCount',
  'condition|BuiltinVariables|||GlobalVariableChildExists':
    'globalVariableChildExists',
  'condition|BuiltinAudio|||GlobalVolume': 'globalVolume',
  'condition|BuiltinFile|||GroupExists': 'groupExists',
  'condition|BuiltinMouse|||HasAnyTouchOrMouseStarted':
    'hasAnyTouchOrMouseStarted',
  'condition|BuiltinMouse|||HasAnyTouchStarted': 'hasAnyTouchStarted',
  'condition|BuiltinScene|||HasGameJustResumed': 'hasGameJustResumed',
  'condition|BuiltinObject|||HasNoForces': 'hasNoForces',
  'condition|BuiltinMouse|||HasTouchEnded': 'hasTouchEnded',
  'condition|Sprite|Sprite||Height': 'spriteHeight',
  'condition|BuiltinObject|||Invisible': 'invisible',
  'condition|BuiltinObject|||IsCursorOnObject': 'isCursorOnObject',
  'condition|BuiltinObject|||IsEffectEnabled': 'objectIsEffectEnabled',
  'condition|BuiltinWindow|||IsFullScreen': 'isFullScreen',
  'condition|BuiltinMouse|||IsMouseInsideCanvas': 'isMouseInsideCanvas',
  'condition|BuiltinMouse|||IsMouseWheelScrollingDown':
    'isMouseWheelScrollingDown',
  'condition|BuiltinMouse|||IsMouseWheelScrollingUp': 'isMouseWheelScrollingUp',
  'condition|BuiltinObject|||IsTotalForceAngleAround':
    'isTotalForceAngleAround',
  'condition|BuiltinObject|||IsTotalForceAngleTowardObject':
    'isTotalForceAngleTowardObject',
  'condition|BuiltinObject|||IsTurnedTowardObject': 'isTurnedTowardObject',
  'condition|BuiltinObject|||IsTurnedTowardObject3D': 'isTurnedTowardObject3D',
  'condition|BuiltinKeyboard|||KeyFromTextJustPressed':
    'keyFromTextJustPressed',
  'condition|BuiltinKeyboard|||KeyFromTextPressed': 'keyFromTextPressed',
  'condition|BuiltinKeyboard|||KeyFromTextReleased': 'keyFromTextReleased',
  'condition|BuiltinKeyboard|||KeyPressed': 'keyPressed',
  'condition|BuiltinKeyboard|||KeyReleased': 'keyReleased',
  'condition|BuiltinObject|||Layer': 'layer',
  'condition|BuiltinCamera|||LayerDefaultZOrder': 'layerDefaultZOrder',
  'condition|BuiltinCamera|||LayerEffectEnabled': 'layerEffectEnabled',
  'condition|BuiltinCamera|||LayerTimeScale': 'layerTimeScale',
  'condition|BuiltinCamera|||LayerVisible': 'layerVisible',
  'condition|Leaderboards|||Leaderboards::HasLastSaveErrored':
    'leaderboardSaveErrored',
  'condition|Leaderboards|||Leaderboards::HasLastSaveSucceeded':
    'leaderboardSaveSucceeded',
  'condition|Leaderboards|||Leaderboards::HasPlayerJustClosedLeaderboardView':
    'hasPlayerJustClosedLeaderboardView',
  'condition|Leaderboards|||Leaderboards::IsLeaderboardViewErrored':
    'isLeaderboardViewErrored',
  'condition|Leaderboards|||Leaderboards::IsLeaderboardViewLoaded':
    'isLeaderboardViewLoaded',
  'condition|Leaderboards|||Leaderboards::IsLeaderboardViewLoading':
    'isLeaderboardViewLoading',
  'condition|Leaderboards|||Leaderboards::IsSaving': 'isSavingLeaderboardScore',
  'condition|LinkedObjects|||LinkedObjects::PickObjectsLinkedTo':
    'pickObjectsLinkedTo',
  'condition|Model3DBoneAttachment||Model3DBoneAttachment::Model3DBoneAttachmentBehavior|Model3DBoneAttachment::Model3DBoneAttachmentBehavior::IsAttachedToModelBone':
    'isAttachedToModelBone',
  'condition|Model3DBoneAttachment||Model3DBoneAttachment::Model3DBoneAttachmentBehavior|Model3DBoneAttachment::Model3DBoneAttachmentBehavior::IsBoneAttachmentResolved':
    'isBoneAttachmentResolved',
  'condition|BuiltinMouse|||MouseButtonFromTextPressed':
    'mouseButtonFromTextPressed',
  'condition|BuiltinMouse|||MouseButtonFromTextReleased':
    'mouseButtonFromTextReleased',
  'condition|BuiltinMouse|||MouseButtonPressed': 'mouseButtonPressed',
  'condition|BuiltinMouse|||MouseButtonReleased': 'mouseButtonReleased',
  'condition|BuiltinMouse|||MouseOnlyCursorY': 'mouseOnlyCursorY',
  'condition|BuiltinMouse|||MouseOnlyOnlyCursorX': 'mouseOnlyOnlyCursorX',
  'condition|BuiltinMouse|||MouseX': 'mouseX',
  'condition|BuiltinMouse|||MouseY': 'mouseY',
  'condition|Multiplayer|||Multiplayer::CurrentPlayerNumber':
    'currentPlayerNumber',
  'condition|Multiplayer|||Multiplayer::HasAnyPlayerJoined':
    'hasAnyPlayerJoined',
  'condition|Multiplayer|||Multiplayer::HasAnyPlayerLeft': 'hasAnyPlayerLeft',
  'condition|Multiplayer|||Multiplayer::HasLobbyGameJustEnded':
    'hasLobbyGameJustEnded',
  'condition|Multiplayer|||Multiplayer::HasLobbyGameJustStarted':
    'hasLobbyGameJustStarted',
  'condition|Multiplayer|||Multiplayer::HasMessageBeenReceived':
    'hasMessageBeenReceived',
  'condition|Multiplayer|||Multiplayer::HasPlayerJoined': 'hasPlayerJoined',
  'condition|Multiplayer|||Multiplayer::HasPlayerLeft': 'hasPlayerLeft',
  'condition|Multiplayer|||Multiplayer::IsLobbiesWindowOpen':
    'isLobbiesWindowOpen',
  'condition|Multiplayer|||Multiplayer::IsLobbyGameRunning':
    'isLobbyGameRunning',
  'condition|Multiplayer|||Multiplayer::IsMigratingHost': 'isMigratingHost',
  'condition|Multiplayer|||Multiplayer::IsPlayerConnected': 'isPlayerConnected',
  'condition|Multiplayer|||Multiplayer::IsPlayerHost': 'isPlayerHost',
  'condition|Multiplayer|||Multiplayer::IsSearchingForLobbyToJoin':
    'isSearchingForLobbyToJoin',
  'condition|Multiplayer||Multiplayer::MultiplayerObjectBehavior|Multiplayer::MultiplayerObjectBehavior::IsObjectOwnedByCurrentPlayer':
    'isObjectOwnedByCurrentPlayer',
  'condition|Multiplayer||Multiplayer::MultiplayerObjectBehavior|Multiplayer::MultiplayerObjectBehavior::PlayerObjectOwnership':
    'playerObjectOwnership',
  'condition|Multiplayer|||Multiplayer::ObjectsSynchronizationRate':
    'objectsSynchronizationRate',
  'condition|Multiplayer|||Multiplayer::PlayerVariableOwnership':
    'playerVariableOwnership',
  'condition|Multiplayer|||Multiplayer::PlayersInLobbyCount':
    'playersInLobbyCount',
  'condition|Multiplayer|||Multiplayer::QuickJoinJustFailed':
    'quickJoinJustFailed',
  'condition|BuiltinAudio|||MusicCanalVolume': 'musicCanalVolume',
  'condition|BuiltinAudio|||MusicChannelPitch': 'musicChannelPitch',
  'condition|BuiltinAudio|||MusicChannelPlayingOffset':
    'musicChannelPlayingOffset',
  'condition|BuiltinAudio|||MusicChannelVolume': 'musicChannelVolume',
  'condition|BuiltinAudio|||MusicPaused': 'musicPaused',
  'condition|BuiltinAudio|||MusicPlaying': 'musicPlaying',
  'condition|BuiltinAudio|||MusicStopped': 'musicStopped',
  'condition|NavMeshPathfinding||NavMeshPathfinding::NavMeshCharacterBehavior|NavMeshPathfinding::DestinationReached':
    'navMeshPathfindingDestinationReached',
  'condition|NavMeshPathfinding||NavMeshPathfinding::NavMeshCharacterBehavior|NavMeshPathfinding::NavMeshCharacterBehavior::Acceleration':
    'navMeshPathfindingAcceleration',
  'condition|NavMeshPathfinding||NavMeshPathfinding::NavMeshCharacterBehavior|NavMeshPathfinding::NavMeshCharacterBehavior::AngleOffset':
    'navMeshPathfindingAngleOffset',
  'condition|NavMeshPathfinding||NavMeshPathfinding::NavMeshCharacterBehavior|NavMeshPathfinding::NavMeshCharacterBehavior::AngularMaxSpeed':
    'navMeshPathfindingAngularMaxSpeed',
  'condition|NavMeshPathfinding||NavMeshPathfinding::NavMeshCharacterBehavior|NavMeshPathfinding::NavMeshCharacterBehavior::MaxSpeed':
    'navMeshPathfindingMaxSpeed',
  'condition|NavMeshPathfinding||NavMeshPathfinding::NavMeshCharacterBehavior|NavMeshPathfinding::NavMeshCharacterBehavior::MovementAngleIsAround':
    'navMeshPathfindingMovementAngleIsAround',
  'condition|NavMeshPathfinding||NavMeshPathfinding::NavMeshCharacterBehavior|NavMeshPathfinding::NavMeshCharacterBehavior::ObjectRotated':
    'navMeshPathfindingObjectRotated',
  'condition|NavMeshPathfinding||NavMeshPathfinding::NavMeshCharacterBehavior|NavMeshPathfinding::NavMeshCharacterBehavior::Speed':
    'navMeshPathfindingSpeed',
  'condition|NavMeshPathfinding||NavMeshPathfinding::NavMeshCharacterBehavior|NavMeshPathfinding::PathFound':
    'navMeshPathfindingPathFound',
  'condition|BuiltinObject|||NbObjet': 'nbObjet',
  'condition|BuiltinObject|||NumberObjectVariable': 'numberObjectVariable',
  'condition|BuiltinVariables|||NumberVariable': 'numberVariable',
  'condition|BuiltinObject|||ObjectTimer': 'objectTimer',
  'condition|BuiltinObject|||ObjectTimerPaused': 'objectTimerPaused',
  'condition|BuiltinObject|||ObjectVariableAsBoolean':
    'objectVariableAsBoolean',
  'condition|BuiltinObject|||ObjectVariableChildCount':
    'objectVariableChildCount',
  'condition|BuiltinObject|||ObjectVariableChildExists':
    'objectVariableChildExists',
  'condition|Sprite|Sprite||Opacity': 'spriteOpacity',
  'condition|OpacityCapability||OpacityCapability::OpacityBehavior|OpacityCapability::OpacityBehavior::Value':
    'opacityCapabilityValue',
  'condition|P2P|||P2P::IsReady': 'isPeerReady',
  'condition|P2P|||P2P::OnConnection': 'onPeerConnection',
  'condition|P2P|||P2P::OnDisconnection': 'onPeerDisconnection',
  'condition|P2P|||P2P::OnError': 'onPeerError',
  'condition|P2P|||P2P::OnEvent': 'onPeerEvent',
  'condition|PanelSpriteObject|PanelSpriteObject::PanelSprite||PanelSpriteObject::Angle':
    'panelSpriteObjectAngle',
  'condition|PanelSpriteObject|PanelSpriteObject::PanelSprite||PanelSpriteObject::Height':
    'panelSpriteObjectHeight',
  'condition|PanelSpriteObject|PanelSpriteObject::PanelSprite||PanelSpriteObject::Opacity':
    'panelSpriteObjectOpacity',
  'condition|PanelSpriteObject|PanelSpriteObject::PanelSprite||PanelSpriteObject::Width':
    'panelSpriteObjectWidth',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ConeSprayAngle':
    'coneSprayAngle',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::EmitterAngle':
    'emitterAngle',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::EmitterAngleA':
    'emitterAngleA',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::EmitterAngleB':
    'emitterAngleB',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::Flow':
    'flow',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::NoMoreParticles':
    'noMoreParticles',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleAlpha1':
    'particleAlpha1',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleAlpha2':
    'particleAlpha2',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleBlue1':
    'particleBlue1',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleBlue2':
    'particleBlue2',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleEmitter::AdditiveRendering':
    'additiveRendering',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleEmitter::MaxParticlesCount':
    'maxParticlesCount',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleEmitter::ParticleRotationMaxSpeed':
    'particleRotationMaxSpeed',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleEmitter::ParticleRotationMinSpeed':
    'particleRotationMinSpeed',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleGravityAngle':
    'particleGravityAngle',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleGravityLength':
    'particleGravityLength',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleGravityX':
    'particleGravityX',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleGravityY':
    'particleGravityY',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleGreen1':
    'particleGreen1',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleGreen2':
    'particleGreen2',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleLifeTimeMax':
    'particleLifeTimeMax',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleLifeTimeMin':
    'particleLifeTimeMin',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleRed1':
    'particleRed1',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleRed2':
    'particleRed2',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleSize1':
    'particleSize1',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ParticleSize2':
    'particleSize2',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::Tank':
    'tank',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::Texture':
    'texture',
  'condition|ParticleSystem|ParticleSystem::ParticleEmitter||ParticleSystem::ZoneRadius':
    'zoneRadius',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::Acceleration':
    'pathfindingBehaviorAcceleration',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::AngleOffset':
    'pathfindingBehaviorAngleOffset',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::AngularMaxSpeed':
    'pathfindingBehaviorAngularMaxSpeed',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::CellHeight':
    'cellHeight',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::CellWidth':
    'cellWidth',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingObstacleBehavior|PathfindingBehavior::Cost':
    'cost',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::DestinationReached':
    'pathfindingBehaviorDestinationReached',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::DiagonalsAllowed':
    'pathfindingBehaviorDiagonalsAllowed',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::ExtraBorder':
    'pathfindingBehaviorExtraBorder',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingObstacleBehavior|PathfindingBehavior::IsImpassable':
    'isImpassable',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::MaxSpeed':
    'pathfindingBehaviorMaxSpeed',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::ObjectRotated':
    'pathfindingBehaviorObjectRotated',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::PathFound':
    'pathfindingBehaviorPathFound',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::PathfindingBehavior::GridOffsetX':
    'gridOffsetX',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::PathfindingBehavior::GridOffsetY':
    'gridOffsetY',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::PathfindingBehavior::MovementAngleIsAround':
    'pathfindingBehaviorMovementAngleIsAround',
  'condition|PathfindingBehavior||PathfindingBehavior::PathfindingBehavior|PathfindingBehavior::Speed':
    'pathfindingBehaviorSpeed',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::AngularDamping':
    'physics2AngularDamping',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::AngularVelocity':
    'angularVelocity',
  'condition|Physics2|||Physics2::Collision': 'physics2Collision',
  'condition|Physics2|||Physics2::CollisionStarted': 'physics2CollisionStarted',
  'condition|Physics2|||Physics2::CollisionStopped': 'physics2CollisionStopped',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::Density':
    'physics2Density',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::Friction':
    'physics2Friction',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::GravityScale':
    'physics2GravityScale',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::GravityX':
    'physics2GravityX',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::GravityY':
    'physics2GravityY',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::HasFixedRotation':
    'physics2HasFixedRotation',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::IsBullet':
    'physics2IsBullet',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::IsDynamic':
    'physics2IsDynamic',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::IsKinematic':
    'physics2IsKinematic',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::IsSleeping':
    'isSleeping',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::IsSleepingAllowed':
    'isSleepingAllowed',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::IsStatic':
    'physics2IsStatic',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::JointFirstObject':
    'jointFirstObject',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::JointReactionForce':
    'jointReactionForce',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::JointReactionTorque':
    'jointReactionTorque',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::JointSecondObject':
    'jointSecondObject',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::LayerEnabled':
    'physics2LayerEnabled',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::LinearDamping':
    'physics2LinearDamping',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::LinearVelocityAngle':
    'linearVelocityAngle',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::LinearVelocityLength':
    'physics2LinearVelocityLength',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::LinearVelocityX':
    'physics2LinearVelocityX',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::LinearVelocityY':
    'physics2LinearVelocityY',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::MaskEnabled':
    'physics2MaskEnabled',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::Physics2Behavior::IsLinearVelocityAngleAround':
    'isLinearVelocityAngleAround',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::PrismaticJointLimitsEnabled':
    'prismaticJointLimitsEnabled',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::PrismaticJointMotorEnabled':
    'prismaticJointMotorEnabled',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::Restitution':
    'physics2Restitution',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::RevoluteJointLimitsEnabled':
    'revoluteJointLimitsEnabled',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::RevoluteJointMotorEnabled':
    'revoluteJointMotorEnabled',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::TimeScale':
    'physics2TimeScale',
  'condition|Physics2||Physics2::Physics2Behavior|Physics2::WheelJointMotorEnabled':
    'wheelJointMotorEnabled',
  'condition|Physics3D|||Physics3D::Collision': 'physics3DCollision',
  'condition|Physics3D|||Physics3D::CollisionStarted':
    'physics3DCollisionStarted',
  'condition|Physics3D|||Physics3D::CollisionStopped':
    'physics3DCollisionStopped',
  'condition|Physics3D|||Physics3D::IsObjectOnGivenFloor':
    'physics3DIsObjectOnGivenFloor',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::AngularDamping':
    'physics3DAngularDamping',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::AngularVelocityX':
    'angularVelocityX',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::AngularVelocityY':
    'angularVelocityY',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::AngularVelocityZ':
    'angularVelocityZ',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::Density':
    'physics3DDensity',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::Friction':
    'physics3DFriction',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::GravityScale':
    'physics3DGravityScale',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::GravityX':
    'physics3DGravityX',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::GravityY':
    'physics3DGravityY',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::GravityZ':
    'gravityZ',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::HasFixedRotation':
    'physics3DHasFixedRotation',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::IsBullet':
    'physics3DIsBullet',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::IsDynamic':
    'physics3DIsDynamic',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::IsKinematic':
    'physics3DIsKinematic',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::IsStatic':
    'physics3DIsStatic',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::LayerEnabled':
    'physics3DLayerEnabled',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::LinearDamping':
    'physics3DLinearDamping',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::LinearVelocityLength':
    'physics3DLinearVelocityLength',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::LinearVelocityX':
    'physics3DLinearVelocityX',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::LinearVelocityY':
    'physics3DLinearVelocityY',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::LinearVelocityZ':
    'linearVelocityZ',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::MaskEnabled':
    'physics3DMaskEnabled',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::Restitution':
    'physics3DRestitution',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::ShapeOffsetX':
    'shapeOffsetX',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::ShapeOffsetY':
    'shapeOffsetY',
  'condition|Physics3D||Physics3D::Physics3DBehavior|Physics3D::Physics3DBehavior::ShapeOffsetZ':
    'shapeOffsetZ',
  'condition|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::CurrentGear':
    'currentGear',
  'condition|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::EngineInertia':
    'engineInertia',
  'condition|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::EngineSpeed':
    'engineSpeed',
  'condition|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::EngineSpeedMax':
    'engineSpeedMax',
  'condition|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::EngineTorqueMax':
    'engineTorqueMax',
  'condition|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::IsOnFloor':
    'physics3DIsOnFloor',
  'condition|Physics3D||Physics3D::PhysicsCar3D|Physics3D::PhysicsCar3D::SteerAngle':
    'steerAngle',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::CanJump':
    'physics3DCanJump',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::CurrentFallSpeed':
    'physics3DCurrentFallSpeed',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::CurrentForwardSpeed':
    'currentForwardSpeed',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::CurrentJumpSpeed':
    'physics3DCurrentJumpSpeed',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::CurrentSidewaysSpeed':
    'currentSidewaysSpeed',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::FallingSpeedMax':
    'fallingSpeedMax',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::ForwardAcceleration':
    'forwardAcceleration',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::ForwardDeceleration':
    'forwardDeceleration',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::ForwardSpeedMax':
    'forwardSpeedMax',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::Gravity':
    'physics3DGravity',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::IsFalling':
    'physics3DIsFalling',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::IsForwardAngleAround':
    'isForwardAngleAround',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::IsJumping':
    'physics3DIsJumping',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::IsMovingEvenALittle':
    'physics3DIsMovingEvenALittle',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::IsOnFloor':
    'physics3DPhysicsCharacter3DIsOnFloor',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::JumpSpeed':
    'physics3DJumpSpeed',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::JumpSustainTime':
    'physics3DJumpSustainTime',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::ShouldBindObjectAndForwardAngle':
    'shouldBindObjectAndForwardAngle',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SidewaysAcceleration':
    'sidewaysAcceleration',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SidewaysDeceleration':
    'sidewaysDeceleration',
  'condition|Physics3D||Physics3D::PhysicsCharacter3D|Physics3D::PhysicsCharacter3D::SidewaysSpeedMax':
    'sidewaysSpeedMax',
  'condition|BuiltinObject|||PickAllInstances': 'pickAllInstances',
  'condition|BuiltinObject|||PickNearest': 'pickNearest',
  'condition|BuiltinObject|||PickRandomInstance': 'pickRandomInstance',
  'condition|BuiltinObject|||PickedInstancesCount': 'pickedInstancesCount',
  'condition|BuiltinObject|||Plan': 'plan',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::Acceleration':
    'platformBehaviorAcceleration',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::CanGrabPlatforms':
    'canGrabPlatforms',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::CanJump':
    'platformBehaviorCanJump',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::CurrentFallSpeed':
    'platformBehaviorCurrentFallSpeed',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::CurrentJumpSpeed':
    'platformBehaviorCurrentJumpSpeed',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::CurrentSpeed':
    'currentSpeed',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::Deceleration':
    'platformBehaviorDeceleration',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::Gravity':
    'platformBehaviorGravity',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::IsFalling':
    'platformBehaviorIsFalling',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::IsGrabbingPlatform':
    'isGrabbingPlatform',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::IsJumping':
    'platformBehaviorIsJumping',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::IsMoving':
    'platformBehaviorIsMoving',
  'condition|PlatformBehavior|||PlatformBehavior::IsObjectOnGivenFloor':
    'platformBehaviorIsObjectOnGivenFloor',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::IsOnFloor':
    'platformBehaviorIsOnFloor',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::IsOnLadder':
    'isOnLadder',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::JumpSpeed':
    'platformBehaviorJumpSpeed',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::JumpSustainTime':
    'platformBehaviorJumpSustainTime',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::LadderClimbingSpeed':
    'ladderClimbingSpeed',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::MaxFallingSpeed':
    'maxFallingSpeed',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::MaxSpeed':
    'platformBehaviorMaxSpeed',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::PlatformerObjectBehavior::IsMovingEvenALittle':
    'platformBehaviorIsMovingEvenALittle',
  'condition|PlatformBehavior||PlatformBehavior::PlatformerObjectBehavior|PlatformBehavior::PlatformerObjectBehavior::IsUsingControl':
    'platformBehaviorIsUsingControl',
  'condition|PlayerAuthentication|||PlayerAuthentication::HasPlayerLoggedIn':
    'hasPlayerLoggedIn',
  'condition|PlayerAuthentication|||PlayerAuthentication::IsAuthenticationWindowOpen':
    'isAuthenticationWindowOpen',
  'condition|PlayerAuthentication|||PlayerAuthentication::IsPlayerAuthenticated':
    'isPlayerAuthenticated',
  'condition|BuiltinMouse|||PopEndedTouch': 'popEndedTouch',
  'condition|BuiltinMouse|||PopStartedTouch': 'popStartedTouch',
  'condition|BuiltinObject|||PosX': 'objectX',
  'condition|BuiltinObject|||PosY': 'objectY',
  'condition|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::AreCoordinatesRelative':
    'areCoordinatesRelative',
  'condition|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::CheckAntialiasing':
    'checkAntialiasing',
  'condition|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::ClearBetweenFrames':
    'clearBetweenFrames',
  'condition|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::Drawer::ScaleX':
    'primitiveDrawingScaleX',
  'condition|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::Drawer::ScaleY':
    'primitiveDrawingScaleY',
  'condition|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::FillOpacity':
    'primitiveDrawingFillOpacity',
  'condition|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::FlippedX':
    'primitiveDrawingFlippedX',
  'condition|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::FlippedY':
    'primitiveDrawingFlippedY',
  'condition|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::OutlineOpacity':
    'outlineOpacity',
  'condition|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::OutlineSize':
    'outlineSize',
  'condition|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::ScaleX':
    'primitiveDrawingDrawerScaleX',
  'condition|PrimitiveDrawing|PrimitiveDrawing::Drawer||PrimitiveDrawing::ScaleY':
    'primitiveDrawingDrawerScaleY',
  'condition|BuiltinObject|||Raycast': 'raycast',
  'condition|BuiltinObject|||RaycastToPosition': 'raycastToPosition',
  'condition|ResizableCapability||ResizableCapability::ResizableBehavior|ResizableCapability::ResizableBehavior::Height':
    'resizableCapabilityHeight',
  'condition|ResizableCapability||ResizableCapability::ResizableBehavior|ResizableCapability::ResizableBehavior::Width':
    'resizableCapabilityWidth',
  'condition|SaveState|||SaveState::CheckJustCompleted': 'checkJustCompleted',
  'condition|SaveState|||SaveState::CheckedSaveExists': 'checkedSaveExists',
  'condition|SaveState|||SaveState::DeleteJustFailed': 'deleteJustFailed',
  'condition|SaveState|||SaveState::DeleteJustSucceeded': 'deleteJustSucceeded',
  'condition|SaveState|||SaveState::DuplicateJustFailed': 'duplicateJustFailed',
  'condition|SaveState|||SaveState::DuplicateJustSucceeded':
    'duplicateJustSucceeded',
  'condition|SaveState|||SaveState::ListJustCompleted': 'listJustCompleted',
  'condition|SaveState|||SaveState::LoadJustFailed': 'loadJustFailed',
  'condition|SaveState|||SaveState::LoadJustSucceeded': 'loadJustSucceeded',
  'condition|SaveState|||SaveState::SaveJustFailed': 'saveJustFailed',
  'condition|SaveState|||SaveState::SaveJustSucceeded': 'saveJustSucceeded',
  'condition|SaveState|||SaveState::TimeSinceLastLoad': 'timeSinceLastLoad',
  'condition|SaveState|||SaveState::TimeSinceLastSave': 'timeSinceLastSave',
  'condition|ScalableCapability||ScalableCapability::ScalableBehavior|ScalableCapability::ScalableBehavior::Value':
    'scalableCapabilityValue',
  'condition|ScalableCapability||ScalableCapability::ScalableBehavior|ScalableCapability::ScalableBehavior::X':
    'scalableCapabilityX',
  'condition|ScalableCapability||ScalableCapability::ScalableBehavior|ScalableCapability::ScalableBehavior::Y':
    'scalableCapabilityY',
  'condition|Sprite|Sprite||ScaleHeight': 'scaleHeight',
  'condition|Sprite|Sprite||ScaleWidth': 'scaleWidth',
  'condition|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::CenterZ':
    'centerZ',
  'condition|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::Depth':
    'scene3DDepth',
  'condition|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::FlippedZ':
    'scene3DFlippedZ',
  'condition|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::RotationX':
    'scene3DRotationX',
  'condition|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::RotationY':
    'scene3DRotationY',
  'condition|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::ScaleZ':
    'scene3DScaleZ',
  'condition|Scene3D||Scene3D::Base3DBehavior|Scene3D::Base3DBehavior::Z':
    'scene3DZ',
  'condition|Scene3D|||Scene3D::CameraFarPlane': 'cameraFarPlane',
  'condition|Scene3D|||Scene3D::CameraFov': 'cameraFov',
  'condition|Scene3D|||Scene3D::CameraNearPlane': 'cameraNearPlane',
  'condition|Scene3D|||Scene3D::CameraRotationX': 'cameraRotationX',
  'condition|Scene3D|||Scene3D::CameraRotationY': 'cameraRotationY',
  'condition|Scene3D|||Scene3D::CameraZ': 'cameraZ',
  'condition|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::Depth':
    'scene3DCube3DObjectDepth',
  'condition|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::FaceVisibility':
    'faceVisibility',
  'condition|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::FlippedX':
    'scene3DFlippedX',
  'condition|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::FlippedY':
    'scene3DFlippedY',
  'condition|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::FlippedZ':
    'scene3DCube3DObjectFlippedZ',
  'condition|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::Height':
    'scene3DHeight',
  'condition|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::RotationX':
    'scene3DCube3DObjectRotationX',
  'condition|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::RotationY':
    'scene3DCube3DObjectRotationY',
  'condition|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::ScaleX':
    'scene3DScaleX',
  'condition|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::ScaleY':
    'scene3DScaleY',
  'condition|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::ScaleZ':
    'scene3DCube3DObjectScaleZ',
  'condition|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::Width':
    'scene3DWidth',
  'condition|Scene3D|Scene3D::Cube3DObject||Scene3D::Cube3DObject::Z':
    'scene3DCube3DObjectZ',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::HasAnimationEnded':
    'scene3DHasAnimationEnded',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::IsAnimationPaused':
    'scene3DIsAnimationPaused',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::Animation':
    'scene3DAnimation',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::AnimationName':
    'scene3DAnimationName',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::AnimationSpeedScale':
    'scene3DAnimationSpeedScale',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::Depth':
    'scene3DModel3DObjectDepth',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::FlippedX':
    'scene3DModel3DObjectFlippedX',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::FlippedY':
    'scene3DModel3DObjectFlippedY',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::FlippedZ':
    'scene3DModel3DObjectFlippedZ',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::HasBone':
    'hasBone',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::Height':
    'scene3DModel3DObjectHeight',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::RotationX':
    'scene3DModel3DObjectRotationX',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::RotationY':
    'scene3DModel3DObjectRotationY',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::ScaleX':
    'scene3DModel3DObjectScaleX',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::ScaleY':
    'scene3DModel3DObjectScaleY',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::ScaleZ':
    'scene3DModel3DObjectScaleZ',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::Width':
    'scene3DModel3DObjectWidth',
  'condition|Scene3D|Scene3D::Model3DObject||Scene3D::Model3DObject::Z':
    'scene3DModel3DObjectZ',
  'condition|BuiltinObject|||SceneInstancesCount': 'sceneInstancesCount',
  'condition|BuiltinScene|||SceneJustBegins': 'sceneBegins',
  'condition|BuiltinScene|||SceneJustResumed': 'sceneJustResumed',
  'condition|BuiltinScene|||SceneLoadingProgress': 'sceneLoadingProgress',
  'condition|BuiltinVariables|||SceneVariableAsBoolean':
    'sceneVariableAsBoolean',
  'condition|BuiltinVariables|||SceneVariableChildCount':
    'sceneVariableChildCount',
  'condition|BuiltinObject|||SeDirige': 'seDirige',
  'condition|BuiltinScene|||SignalReceived': 'signalReceived',
  'condition|BuiltinAudio|||SoundCanalVolume': 'soundCanalVolume',
  'condition|BuiltinAudio|||SoundChannelPitch': 'soundChannelPitch',
  'condition|BuiltinAudio|||SoundChannelPlayingOffset':
    'soundChannelPlayingOffset',
  'condition|BuiltinAudio|||SoundChannelVolume': 'soundChannelVolume',
  'condition|BuiltinAudio|||SoundPaused': 'soundPaused',
  'condition|BuiltinAudio|||SoundPlaying': 'soundPlaying',
  'condition|BuiltinAudio|||SoundStopped': 'soundStopped',
  'condition|BuiltinMouse|||SourisBouton': 'sourisBouton',
  'condition|BuiltinObject|||SourisSurObjet': 'sourisSurObjet',
  'condition|BuiltinMouse|||SourisX': 'sourisX',
  'condition|BuiltinMouse|||SourisY': 'sourisY',
  'condition|BuiltinObject|||Speed': 'objectSpeed',
  'condition|SpineObject|SpineObject::SpineObject||SpineObject::SpineObject::Animation':
    'spineObjectAnimation',
  'condition|SpineObject|SpineObject::SpineObject||SpineObject::SpineObject::PointAttachmentRotationLocal':
    'pointAttachmentRotationLocal',
  'condition|SpineObject|SpineObject::SpineObject||SpineObject::SpineObject::PointAttachmentRotationWorld':
    'pointAttachmentRotationWorld',
  'condition|SpineObject|SpineObject::SpineObject||SpineObject::SpineObject::PointAttachmentScaleXLocal':
    'pointAttachmentScaleXLocal',
  'condition|SpineObject|SpineObject::SpineObject||SpineObject::SpineObject::PointAttachmentScaleXWorld':
    'pointAttachmentScaleXWorld',
  'condition|SpineObject|SpineObject::SpineObject||SpineObject::SpineObject::PointAttachmentScaleYLocal':
    'pointAttachmentScaleYLocal',
  'condition|SpineObject|SpineObject::SpineObject||SpineObject::SpineObject::PointAttachmentScaleYWorld':
    'pointAttachmentScaleYWorld',
  'condition|SpineObject|SpineObject::SpineObject||SpineObject::SpineObject::PointAttachmentX':
    'pointAttachmentX',
  'condition|SpineObject|SpineObject::SpineObject||SpineObject::SpineObject::PointAttachmentY':
    'pointAttachmentY',
  'condition|SpineObject|SpineObject::SpineObject||SpineObject::SpineObject::getSkin':
    'spineSkin',
  'condition|SpringBoneDynamics||SpringBoneDynamics::SpringBone3DBehavior|SpringBoneDynamics::HasChain':
    'hasChain',
  'condition|SpringBoneDynamics||SpringBoneDynamics::SpringBone3DBehavior|SpringBoneDynamics::HasValidConfiguration':
    'hasValidConfiguration',
  'condition|SpringBoneDynamics||SpringBoneDynamics::SpringBone3DBehavior|SpringBoneDynamics::HasWebGPUFallbackOccurred':
    'springBoneDynamicsHasWebGPUFallbackOccurred',
  'condition|SpringBoneDynamics||SpringBoneDynamics::SpringBone3DBehavior|SpringBoneDynamics::IsBudgetPaused':
    'springBoneDynamicsIsBudgetPaused',
  'condition|SpringBoneDynamics||SpringBoneDynamics::SpringBone3DBehavior|SpringBoneDynamics::IsSimulationEnabled':
    'springBoneDynamicsIsSimulationEnabled',
  'condition|SpringBoneDynamics||SpringBoneDynamics::SpringBone3DBehavior|SpringBoneDynamics::IsSimulationRunning':
    'springBoneDynamicsIsSimulationRunning',
  'condition|SpringBoneDynamics||SpringBoneDynamics::SpringBone3DBehavior|SpringBoneDynamics::IsUsingWebGPU':
    'springBoneDynamicsIsUsingWebGPU',
  'condition|Sprite|Sprite||Sprite': 'sprite',
  'condition|Steamworks|||Steamworks::HasAchievement': 'hasAchievement',
  'condition|Steamworks|||Steamworks::HasPlayerBoughtGame':
    'hasPlayerBoughtGame',
  'condition|Steamworks|||Steamworks::HasPlayerInstalledApp':
    'hasPlayerInstalledApp',
  'condition|Steamworks|||Steamworks::HasPlayerInstalledDLC':
    'hasPlayerInstalledDLC',
  'condition|Steamworks|||Steamworks::IsCloudFileExisting':
    'isCloudFileExisting',
  'condition|Steamworks|||Steamworks::IsDigitalActionPressed':
    'isDigitalActionPressed',
  'condition|Steamworks|||Steamworks::IsOnSteamDeck': 'isOnSteamDeck',
  'condition|Steamworks|||Steamworks::IsPlayerLowViolence':
    'isPlayerLowViolence',
  'condition|Steamworks|||Steamworks::IsPlayerOwningApp': 'isPlayerOwningApp',
  'condition|Steamworks|||Steamworks::IsPlayerVACBanned': 'isPlayerVACBanned',
  'condition|Steamworks|||Steamworks::IsSteamCloudEnabled':
    'isSteamCloudEnabled',
  'condition|Steamworks|||Steamworks::IsSteamworksLoaded': 'isSteamworksLoaded',
  'condition|Steamworks|||Steamworks::IsWorkshopItemState':
    'isWorkshopItemState',
  'condition|BuiltinCommonInstructions|||StrEqual': 'strEqual',
  'condition|BuiltinObject|||StringObjectVariable': 'stringObjectVariable',
  'condition|BuiltinVariables|||StringVariable': 'stringVariable',
  'condition|SvgUI|SvgUI::SvgUIObject||SvgUI::SvgUIObject::LoadError':
    'svgLoadError',
  'condition|SvgUI|SvgUI::SvgUIObject||SvgUI::SvgUIObject::Loaded': 'svgLoaded',
  'condition|SvgUI|SvgUI::SvgUIObject||SvgUI::SvgUIObject::NodeClicked':
    'svgNodeClicked',
  'condition|SystemInfo|||SystemInfo::HasTouchScreen': 'hasTouchScreen',
  'condition|SystemInfo|||SystemInfo::IsMobile': 'isMobile',
  'condition|SystemInfo|||SystemInfo::IsNativeDesktopApp': 'isNativeDesktopApp',
  'condition|SystemInfo|||SystemInfo::IsNativeMobileApp': 'isNativeMobileApp',
  'condition|SystemInfo|||SystemInfo::IsPreview': 'isPreview',
  'condition|SystemInfo|||SystemInfo::IsWebGLSupported': 'isWebGLSupported',
  'condition|TSLMaterial|||TSLMaterial::BackendAvailable':
    'materialBackendAvailable',
  'condition|TSLMaterial||TSLMaterial::Material|TSLMaterial::BindingHasError':
    'materialBindingHasError',
  'condition|TSLMaterial||TSLMaterial::Material|TSLMaterial::BindingMatchedSlot':
    'materialBindingMatchedSlot',
  'condition|TSLMaterial||TSLMaterial::Material|TSLMaterial::HasBinding':
    'hasMaterialBinding',
  'condition|TSLMaterial||TSLMaterial::Material|TSLMaterial::IsBindingReady':
    'isMaterialBindingReady',
  'condition|TextContainerCapability||TextContainerCapability::TextContainerBehavior|TextContainerCapability::TextContainerBehavior::Value':
    'textContainerCapabilityValue',
  'condition|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::BorderOpacity':
    'borderOpacity',
  'condition|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::BorderWidth':
    'borderWidth',
  'condition|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::Disabled':
    'disabled',
  'condition|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::FillOpacity':
    'textInputFillOpacity',
  'condition|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::Focused':
    'focused',
  'condition|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::Font size':
    'fontsize',
  'condition|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::FontResourceName':
    'fontResourceName',
  'condition|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::InputType':
    'inputType',
  'condition|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::IsInputSubmitted':
    'isInputSubmitted',
  'condition|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::Opacity':
    'textInputOpacity',
  'condition|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::Placeholder':
    'placeholder',
  'condition|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::ReadOnly':
    'readOnly',
  'condition|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::SpellCheck':
    'spellCheck',
  'condition|TextInput|TextInput::TextInputObject||TextInput::TextInputObject::Text':
    'textInputText',
  'condition|TextObject|TextObject::Text||TextObject::Angle': 'textObjectAngle',
  'condition|TextObject|TextObject::Text||TextObject::IsBold': 'isBold',
  'condition|TextObject|TextObject::Text||TextObject::IsItalic': 'isItalic',
  'condition|TextObject|TextObject::Text||TextObject::IsWrapping': 'isWrapping',
  'condition|TextObject|TextObject::Text||TextObject::Opacity':
    'textObjectOpacity',
  'condition|TextObject|TextObject::Text||TextObject::Padding': 'padding',
  'condition|TextObject|TextObject::Text||TextObject::ScaleX':
    'textObjectScaleX',
  'condition|TextObject|TextObject::Text||TextObject::ScaleY':
    'textObjectScaleY',
  'condition|TextObject|TextObject::Text||TextObject::Size': 'size',
  'condition|TextObject|TextObject::Text||TextObject::String': 'string',
  'condition|TextObject|TextObject::Text||TextObject::Text::FontSize':
    'textObjectFontSize',
  'condition|TextObject|TextObject::Text||TextObject::Text::IsOutlineEnabled':
    'isOutlineEnabled',
  'condition|TextObject|TextObject::Text||TextObject::Text::IsShadowEnabled':
    'isShadowEnabled',
  'condition|TextObject|TextObject::Text||TextObject::Text::LineHeight':
    'lineHeight',
  'condition|TextObject|TextObject::Text||TextObject::Text::OutlineThickness':
    'outlineThickness',
  'condition|TextObject|TextObject::Text||TextObject::Text::ShadowAngle':
    'shadowAngle',
  'condition|TextObject|TextObject::Text||TextObject::Text::ShadowBlurRadius':
    'shadowBlurRadius',
  'condition|TextObject|TextObject::Text||TextObject::Text::ShadowDistance':
    'shadowDistance',
  'condition|TextObject|TextObject::Text||TextObject::Text::ShadowOpacity':
    'shadowOpacity',
  'condition|TextObject|TextObject::Text||TextObject::TextAlignment':
    'textAlignment',
  'condition|TextObject|TextObject::Text||TextObject::WrappingWidth':
    'textObjectWrappingWidth',
  'condition|TileMap|TileMap::TileMap||TileMap::AnimationFps': 'animationFps',
  'condition|TileMap|TileMap::TileMap||TileMap::AnimationSpeedScale':
    'tileMapAnimationSpeedScale',
  'condition|TileMap|TileMap::CollisionMask||TileMap::CollisionMask::ScaleX':
    'tileMapScaleX',
  'condition|TileMap|TileMap::CollisionMask||TileMap::CollisionMask::ScaleY':
    'tileMapScaleY',
  'condition|TileMap|TileMap::CollisionMask||TileMap::CollisionMask::TilemapJsonFile':
    'tileMapTilemapJsonFile',
  'condition|TileMap|TileMap::CollisionMask||TileMap::CollisionMask::TilesetJsonFile':
    'tileMapTilesetJsonFile',
  'condition|TileMap|TileMap::TileMap||TileMap::DisplayMode': 'displayMode',
  'condition|TileMap|TileMap::SimpleTileMap||TileMap::IsTileFlippedOnXAtGridCoordinates':
    'tileMapIsTileFlippedOnXAtGridCoordinates',
  'condition|TileMap|TileMap::SimpleTileMap||TileMap::IsTileFlippedOnXAtPosition':
    'tileMapIsTileFlippedOnXAtPosition',
  'condition|TileMap|TileMap::SimpleTileMap||TileMap::IsTileFlippedOnYAtGridCoordinates':
    'tileMapIsTileFlippedOnYAtGridCoordinates',
  'condition|TileMap|TileMap::SimpleTileMap||TileMap::IsTileFlippedOnYAtPosition':
    'tileMapIsTileFlippedOnYAtPosition',
  'condition|TileMap|TileMap::TileMap||TileMap::LayerIndex': 'layerIndex',
  'condition|TileMap|TileMap::SimpleTileMap||TileMap::SimpleTileMap::GridColumnCount':
    'tileMapGridColumnCount',
  'condition|TileMap|TileMap::SimpleTileMap||TileMap::SimpleTileMap::GridRowCount':
    'tileMapGridRowCount',
  'condition|TileMap|TileMap::SimpleTileMap||TileMap::SimpleTileMap::TileIdAtGrid':
    'tileMapTileIdAtGrid',
  'condition|TileMap|TileMap::SimpleTileMap||TileMap::SimpleTileMap::TileIdAtPosition':
    'tileMapTileIdAtPosition',
  'condition|TileMap|TileMap::TileMap||TileMap::TileMap::LevelIndex':
    'levelIndex',
  'condition|TileMap|TileMap::TileMap||TileMap::TileMap::ScaleX':
    'tileMapTileMapScaleX',
  'condition|TileMap|TileMap::TileMap||TileMap::TileMap::ScaleY':
    'tileMapTileMapScaleY',
  'condition|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::GridColumnCount':
    'tileMapTileMapBehaviorGridColumnCount',
  'condition|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::GridRowCount':
    'tileMapTileMapBehaviorGridRowCount',
  'condition|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::IsTileFlippedOnXAtGridCoordinates':
    'tileMapTileMapBehaviorIsTileFlippedOnXAtGridCoordinates',
  'condition|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::IsTileFlippedOnXAtPosition':
    'tileMapTileMapBehaviorIsTileFlippedOnXAtPosition',
  'condition|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::IsTileFlippedOnYAtGridCoordinates':
    'tileMapTileMapBehaviorIsTileFlippedOnYAtGridCoordinates',
  'condition|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::IsTileFlippedOnYAtPosition':
    'tileMapTileMapBehaviorIsTileFlippedOnYAtPosition',
  'condition|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::TileIdAtGrid':
    'tileMapTileMapBehaviorTileIdAtGrid',
  'condition|TileMap||TileMap::TileMapBehavior|TileMap::TileMapBehavior::TileIdAtPosition':
    'tileMapTileMapBehaviorTileIdAtPosition',
  'condition|TileMap|TileMap::TileMap||TileMap::TilemapJsonFile':
    'tileMapTileMapTilemapJsonFile',
  'condition|TileMap|TileMap::TileMap||TileMap::TilesetJsonFile':
    'tileMapTileMapTilesetJsonFile',
  'condition|TiledSpriteObject|TiledSpriteObject::TiledSprite||TiledSpriteObject::Angle':
    'tiledSpriteObjectAngle',
  'condition|TiledSpriteObject|TiledSpriteObject::TiledSprite||TiledSpriteObject::Height':
    'tiledSpriteObjectHeight',
  'condition|TiledSpriteObject|TiledSpriteObject::TiledSprite||TiledSpriteObject::Opacity':
    'tiledSpriteObjectOpacity',
  'condition|TiledSpriteObject|TiledSpriteObject::TiledSprite||TiledSpriteObject::Width':
    'tiledSpriteObjectWidth',
  'condition|TiledSpriteObject|TiledSpriteObject::TiledSprite||TiledSpriteObject::XOffset':
    'xOffset',
  'condition|TiledSpriteObject|TiledSpriteObject::TiledSprite||TiledSpriteObject::YOffset':
    'yOffset',
  'condition|BuiltinTime|||TimeScale': 'timeTimeScale',
  'condition|BuiltinTime|||Timer': 'timer',
  'condition|BuiltinTime|||TimerPaused': 'timerPaused',
  'condition|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::Acceleration':
    'topDownMovementBehaviorAcceleration',
  'condition|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::Angle':
    'topDownMovementBehaviorAngle',
  'condition|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::AngleOffset':
    'topDownMovementBehaviorAngleOffset',
  'condition|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::AngularMaxSpeed':
    'topDownMovementBehaviorAngularMaxSpeed',
  'condition|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::Deceleration':
    'topDownMovementBehaviorDeceleration',
  'condition|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::DiagonalsAllowed':
    'topDownMovementBehaviorDiagonalsAllowed',
  'condition|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::IsMoving':
    'topDownMovementBehaviorIsMoving',
  'condition|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::MaxSpeed':
    'topDownMovementBehaviorMaxSpeed',
  'condition|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::ObjectRotated':
    'topDownMovementBehaviorObjectRotated',
  'condition|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::Speed':
    'topDownMovementBehaviorSpeed',
  'condition|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::TopDownMovementBehavior::IsMovementAngleAround':
    'isMovementAngleAround',
  'condition|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::TopDownMovementBehavior::IsUsingControl':
    'topDownMovementBehaviorIsUsingControl',
  'condition|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::TopDownMovementBehavior::MovementAngleOffset':
    'movementAngleOffset',
  'condition|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::XVelocity':
    'xVelocity',
  'condition|TopDownMovementBehavior||TopDownMovementBehavior::TopDownMovementBehavior|TopDownMovementBehavior::YVelocity':
    'yVelocity',
  'condition|BuiltinMouse|||TouchX': 'touchX',
  'condition|BuiltinMouse|||TouchY': 'touchY',
  'condition|BuiltinCommonInstructions|||Toujours': 'toujours',
  'condition|Tween||Tween::TweenBehavior|Tween::Exists': 'tweenExists',
  'condition|Tween||Tween::TweenBehavior|Tween::HasFinished':
    'tweenHasFinished',
  'condition|Tween||Tween::TweenBehavior|Tween::IsPlaying': 'tweenIsPlaying',
  'condition|Tween|||Tween::Progress': 'tweenProgress',
  'condition|Tween|||Tween::SceneTweenExists': 'sceneTweenExists',
  'condition|Tween|||Tween::SceneTweenHasFinished': 'sceneTweenHasFinished',
  'condition|Tween|||Tween::SceneTweenIsPlaying': 'sceneTweenIsPlaying',
  'condition|Tween||Tween::TweenBehavior|Tween::TweenBehavior::Progress':
    'tweenTweenBehaviorProgress',
  'condition|BuiltinVariables|||VarGlobal': 'varGlobal',
  'condition|BuiltinVariables|||VarGlobalDef': 'varGlobalDef',
  'condition|BuiltinVariables|||VarGlobalTxt': 'varGlobalTxt',
  'condition|BuiltinObject|||VarObjet': 'varObjet',
  'condition|BuiltinObject|||VarObjetDef': 'varObjetDef',
  'condition|BuiltinObject|||VarObjetTxt': 'varObjetTxt',
  'condition|BuiltinVariables|||VarScene': 'varScene',
  'condition|BuiltinVariables|||VarSceneDef': 'varSceneDef',
  'condition|BuiltinVariables|||VarSceneTxt': 'varSceneTxt',
  'condition|BuiltinVariables|||VariableChildCount': 'variableChildCount',
  'condition|BuiltinVariables|||VariableChildExists': 'variableChildExists',
  'condition|BuiltinVariables|||VariableChildExists2': 'variableChildExists2',
  'condition|Video|Video::VideoObject||Video::CurrentTime': 'videoCurrentTime',
  'condition|Video|Video::VideoObject||Video::Duration': 'videoDuration',
  'condition|Video|Video::VideoObject||Video::Ended': 'videoEnded',
  'condition|Video|Video::VideoObject||Video::GetOpacity': 'videoOpacity',
  'condition|Video|Video::VideoObject||Video::GetPlaybackSpeed':
    'videoPlaybackSpeed',
  'condition|Video|Video::VideoObject||Video::Loop': 'isVideoLooped',
  'condition|Video|Video::VideoObject||Video::Mute': 'isVideoMuted',
  'condition|Video|Video::VideoObject||Video::Pause': 'isVideoPaused',
  'condition|Video|Video::VideoObject||Video::Play': 'isVideoPlaying',
  'condition|Video|Video::VideoObject||Video::Volume': 'videoVolume',
  'condition|BuiltinObject|||Visible': 'visible',
  'condition|BuiltinObject|||Vitesse': 'vitesse',
  'condition|Sprite|Sprite||Width': 'spriteWidth',
  'condition|BuiltinObject|||ZOrder': 'zOrder',
};

export const getSystemInstructionName = (
  kind: string,
  type: string,
  owner: Object = {}
): string =>
  SYSTEM_INSTRUCTION_NAMES[
    [
      kind,
      owner.extension || '',
      owner.objectType || '',
      owner.behaviorType || '',
      type,
    ].join('|')
  ] || type;
