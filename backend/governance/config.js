module.exports={
 caseType:'versioned_photography_proof_release',initialState:'source_registered',
 states:['source_registered','rights_verified','timeline_edited','render_queued','rendered','render_failed','proof_review','publication_approved','published','exported'],
 createRoles:['photographer','studio_manager'],assessmentRoles:['photographer','editor','rights_reviewer','accessibility_reviewer'],auditRoles:['studio_manager','rights_reviewer','client_approver','auditor'],connectorRoles:['integration_operator','studio_manager'],
 evidenceKinds:['source_manifest','rights_license','consent_release','asset_manifest','timeline_version','render_job_receipt','render_manifest','render_failure','proof_markup','quality_report','accessibility_report','brand_moderation_report','watermark_disclosure','approval_record','publish_receipt','export_manifest','usage_record'],
 requiredSignals:['sourceVersion','timelineVersion','assetVersion','renderVersion','rightsStatus','consentStatus','moderationStatus','accessibilityStatus','markupStatus','timingFidelity','layoutFidelity','exportProfile','policyVersion'],
 professionalBoundary:'Generated or edited photography and video remain drafts; qualified rights, accessibility, brand, studio, and client reviewers approve proofs and publication.',
 connectors:[{name:'media_model',purpose:'queued edit/render receipts only'},{name:'rights_asset_library',purpose:'license and release versions'},{name:'object_storage',purpose:'encrypted asset pointers'},{name:'cdn',purpose:'delivery receipts'},{name:'transcription_translation',purpose:'versioned caption and locale receipts'},{name:'publishing',purpose:'signed publish/export receipts'},{name:'usage_accounting',purpose:'metered usage receipts'}],
 transitions:[
  {from:'source_registered',action:'verify_rights',to:'rights_verified',roles:['rights_reviewer'],requiresEvidence:true},
  {from:'rights_verified',action:'lock_timeline',to:'timeline_edited',roles:['photographer','editor'],requiresEvidence:true},
  {from:'timeline_edited',action:'queue_render',to:'render_queued',roles:['editor'],requiresEvidence:true},
  {from:'render_queued',action:'record_render',to:'rendered',roles:['integration_operator'],requiresEvidence:true},
  {from:'render_queued',action:'record_render_failure',to:'render_failed',roles:['integration_operator'],requiresEvidence:true},
  {from:'render_failed',action:'retry_render',to:'render_queued',roles:['editor','integration_operator'],requiresEvidence:true},
  {from:'rendered',action:'submit_proof_review',to:'proof_review',roles:['client_approver','accessibility_reviewer'],requiresEvidence:true,dualControl:true},
  {from:'proof_review',action:'approve_publication',to:'publication_approved',roles:['studio_manager','rights_reviewer'],requiresEvidence:true,dualControl:true},
  {from:'publication_approved',action:'record_publish',to:'published',roles:['studio_manager'],requiresEvidence:true,dualControl:true},
  {from:'publication_approved',action:'record_export',to:'exported',roles:['photographer','editor'],requiresEvidence:true,dualControl:true}
 ],
 acceptedFixture:{sourceVersion:'s1',timelineVersion:'t1',assetVersion:'a1',renderVersion:'r1',rightsStatus:'verified',consentStatus:'verified',moderationStatus:'passed',accessibilityStatus:'passed',markupStatus:'approved',timingFidelity:0.99,layoutFidelity:0.99,exportProfile:'accessible_master',policyVersion:'p1'},
 readyDisposition:'human_publication_review_required',holdDisposition:'rights_quality_or_fidelity_hold',decisionField:'publishCommand',
 assess:x=>{const timing=Number(x.timingFidelity),layout=Number(x.layoutFidelity);const fidelity=Number.isFinite(timing)&&Number.isFinite(layout)&&timing>=0.95&&timing<=1&&layout>=0.95&&layout<=1;const ready=x.rightsStatus==='verified'&&x.consentStatus==='verified'&&x.moderationStatus==='passed'&&x.accessibilityStatus==='passed'&&x.markupStatus==='approved'&&fidelity&&['accessible_master','print_master','web_gallery'].includes(x.exportProfile);return{disposition:ready?'human_publication_review_required':'rights_quality_or_fidelity_hold',publishCommand:null,metrics:{timingFidelity:timing,layoutFidelity:layout},versions:{source:x.sourceVersion,timeline:x.timelineVersion,assets:x.assetVersion,render:x.renderVersion}};}
};
