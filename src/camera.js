// Own the camera independently of the decoder so playback failures cannot be silent.
const transientDecodeErrors=new Set(['NotFoundException','ChecksumException','FormatException']);
const stopTracks=stream=>stream?.getTracks().forEach(track=>track.stop());
const errorWithName=(name,message)=>Object.assign(new Error(message),{name});
function bounded(promise,signal,ms,message){
  return new Promise((resolve,reject)=>{
    let timer;
    const finish=(fn,value)=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);fn(value);};
    const cancel=()=>finish(reject,errorWithName('AbortError','Camera stopped.'));
    if(signal.aborted){cancel();return;}
    signal.addEventListener('abort',cancel,{once:true});
    timer=setTimeout(()=>finish(reject,errorWithName('TimeoutError',message)),ms);
    Promise.resolve(promise).then(value=>finish(resolve,value),error=>finish(reject,error));
  });
}
function waitForFrame(video,signal,ms){
  return new Promise((resolve,reject)=>{
    const started=Date.now();let timer;
    const finish=(fn,value)=>{clearTimeout(timer);signal.removeEventListener('abort',cancel);fn(value);};
    const cancel=()=>finish(reject,errorWithName('AbortError','Camera stopped.'));
    const check=()=>{
      if(signal.aborted){cancel();return;}
      if(!video.paused&&video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0&&video.currentTime>0){finish(resolve);return;}
      if(Date.now()-started>=ms){finish(reject,errorWithName('TimeoutError','Camera permission was granted, but the preview did not start. Tap Retry camera. If it repeats in the Home Screen app, try Daily Fuel in Safari.'));return;}
      timer=setTimeout(check,Math.min(50,ms));
    };
    signal.addEventListener('abort',cancel,{once:true});check();
  });
}
function cameraMessage(error,stage){
  if(error.name==='TimeoutError')return error.message;
  if(stage==='request'&&(error.name==='NotAllowedError'||error.name==='SecurityError'))return 'Camera permission is blocked. Allow camera access for Daily Fuel and retry, or type the barcode below.';
  if(error.name==='NotFoundError'||error.name==='OverconstrainedError')return 'No available camera was found. Try Safari or type the barcode below.';
  if(error.name==='NotReadableError'||error.name==='AbortError')return 'The camera could not start. Close any other app using it, then retry, or type the barcode below.';
  if(stage==='decoder')return 'The barcode scanner could not start. Retry with internet available or type the barcode below.';
  return 'The camera preview could not start. Tap Retry camera, or open Daily Fuel in Safari and try there. You can still type the barcode below.';
}
export function createBarcodeScanner({video,mediaDevices,loadReader,onState=()=>{},onResult=()=>{},timeoutMs=8000,requestTimeoutMs=30000}){
  let generation=0,abort,stream,controls,phase='idle';
  const publish=(next,message='')=>{phase=next;onState({phase:next,message});};
  function release(){
    const oldControls=controls;controls=null;
    oldControls?.stop();stopTracks(stream);stream=null;
    video.pause();video.srcObject=null;video.removeAttribute('src');video.controls=false;
  }
  function stop(){generation++;abort?.abort();abort=null;release();publish('idle');}
  function fail(error,stage,token){if(token!==generation)return;stop();publish('error',cameraMessage(error,stage));}
  async function playAndDecode(token){
    const signal=abort.signal;let stage='play';
    publish('starting');
    try{
      // On resume this call happens directly in the button click, before any await.
      await bounded(video.play(),signal,timeoutMs,'The camera preview did not start. Tap Retry camera or try Daily Fuel in Safari.');
      await waitForFrame(video,signal,timeoutMs);
      if(token!==generation)return;
      stage='decoder';publish('loading');
      const reader=await bounded(loadReader(),signal,timeoutMs,'The camera is ready, but the barcode scanner did not load. Retry with internet available or type the barcode below.');
      if(token!==generation)return;
      const callback=(result,error)=>{
        if(token!==generation)return;
        if(result){const code=result.getText();stop();onResult(code);}
        else if(error&&!transientDecodeErrors.has(error.getKind?.()||error.name))fail(error,'decoder',token);
      };
      // Keep cleanup attached even if the decoder resolves after dismissal/timeout.
      const decoding=Promise.resolve(reader.decodeFromVideoElement(video,callback));
      decoding.then(next=>{if(token!==generation)next.stop();},()=>{});
      const next=await bounded(decoding,signal,timeoutMs,'The barcode scanner did not start. Tap Retry camera or type the barcode below.');
      if(token!==generation)return;
      controls=next;publish('scanning');
    }catch(error){
      if(token!==generation)return;
      if(stage==='play'&&error.name==='NotAllowedError'){
        video.controls=true;publish('needs-play','Camera access is allowed. Tap Play camera to start the preview.');
      }else fail(error,stage,token);
    }
  }
  async function start(){
    stop();const token=++generation;abort=new AbortController();
    video.muted=true;video.defaultMuted=true;video.autoplay=true;video.playsInline=true;
    for(const name of ['muted','autoplay','playsinline','webkit-playsinline'])video.setAttribute(name,'');
    publish('requesting');
    try{
      if(!mediaDevices?.getUserMedia)throw errorWithName('NotFoundError','Camera access unavailable.');
      // Request permission on the original tap, before lazy-loading the scanner.
      const request=Promise.resolve(mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false}));
      request.then(next=>{if(token!==generation)stopTracks(next);},()=>{});
      const granted=await bounded(request,abort.signal,requestTimeoutMs,'Camera access did not finish. Tap Retry camera and respond to the permission prompt, or try Daily Fuel in Safari.');
      if(token!==generation)return;
      stream=granted;video.srcObject=stream;
      await playAndDecode(token);
    }catch(error){fail(error,'request',token);}
  }
  function resume(){if(phase==='needs-play'&&stream)return playAndDecode(generation);return start();}
  return {start,resume,stop};
}
