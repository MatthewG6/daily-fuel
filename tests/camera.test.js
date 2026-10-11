import test from 'node:test';
import assert from 'node:assert/strict';
import {createBarcodeScanner} from '../src/camera.js';

const namedError=name=>Object.assign(new Error(name),{name});
function fixture(options={}) {
  const events=[],states=[],results=[];
  let callback,decodeStops=0,trackStops=0,requests=0;
  const track={stop(){trackStops++;},readyState:'live'};
  const stream={getTracks:()=>[track]};
  const video={srcObject:null,paused:true,readyState:0,videoWidth:0,videoHeight:0,currentTime:0,
    setAttribute(){},removeAttribute(){},pause(){this.paused=true;},
    async play(){events.push('play');if(options.playError){const e=options.playError;options.playError=null;throw e;}if(!options.noFrames){this.paused=false;this.readyState=4;this.videoWidth=1280;this.videoHeight=720;this.currentTime=1;}}
  };
  const controls={stop(){decodeStops++;}};
  const reader={async decodeFromVideoElement(v,cb){assert.equal(v,video);assert.ok(video.videoWidth>0);callback=cb;if(options.onDecode)options.onDecode(cb);return options.decode?options.decode(controls):controls;}};
  const scanner=createBarcodeScanner({video,mediaDevices:{getUserMedia(constraints){requests++;events.push('request');assert.equal(constraints.audio,false);return options.request?options.request():options.cameraError?Promise.reject(options.cameraError):Promise.resolve(stream);}},
    loadReader:async()=>{events.push('decoder');return reader;},onState:s=>states.push(s),onResult:code=>results.push(code),timeoutMs:20,requestTimeoutMs:20});
  return {scanner,video,stream,events,states,results,options,callback:()=>callback,counts:()=>({decodeStops,trackStops,requests})};
}

test('camera is requested on the tap before decoder loading and preview is playing before scanning',async()=>{
  const f=fixture(),pending=f.scanner.start();
  assert.equal(f.events[0],'request');
  await pending;
  assert.equal(f.video.muted,true);assert.equal(f.video.autoplay,true);assert.equal(f.video.playsInline,true);
  assert.deepEqual(f.events,['request','play','decoder']);
  assert.equal(f.states.at(-1).phase,'scanning');
  f.scanner.stop();assert.equal(f.counts().trackStops,1);assert.equal(f.counts().decodeStops,1);assert.equal(f.video.srcObject,null);
});

test('blocked autoplay offers a direct play action that reuses the permitted camera',async()=>{
  const f=fixture({playError:namedError('NotAllowedError')});
  await f.scanner.start();assert.equal(f.states.at(-1).phase,'needs-play');
  assert.equal(f.counts().trackStops,0);assert.ok(!f.events.includes('decoder'));
  const pending=f.scanner.resume();assert.equal(f.events.at(-1),'play');await pending;
  assert.equal(f.states.at(-1).phase,'scanning');assert.equal(f.counts().requests,1);f.scanner.stop();
});

test('permission errors and a preview that never delivers frames report a failure and allow retry',async()=>{
  const denied=fixture({cameraError:namedError('NotAllowedError')});await denied.scanner.start();
  assert.equal(denied.states.at(-1).phase,'error');assert.match(denied.states.at(-1).message,/permission/i);
  denied.options.cameraError=null;await denied.scanner.start();assert.equal(denied.states.at(-1).phase,'scanning');denied.scanner.stop();
  const blank=fixture({noFrames:true});await blank.scanner.start();assert.equal(blank.states.at(-1).phase,'error');
  assert.match(blank.states.at(-1).message,/preview/i);assert.equal(blank.counts().trackStops,1);assert.equal(blank.video.srcObject,null);
});

test('closing during permission or decoder loading releases late resources without delivering results',async()=>{
  let grant;const f=fixture({request:()=>new Promise(resolve=>grant=resolve)});
  const pending=f.scanner.start();f.scanner.stop();grant(f.stream);await pending;
  assert.equal(f.counts().trackStops,1);assert.equal(f.video.srcObject,null);assert.ok(!f.events.includes('decoder'));
  const g=fixture();g.options.onDecode=()=>g.scanner.stop();await g.scanner.start();
  assert.equal(g.counts().trackStops,1);assert.equal(g.counts().decodeStops,1);assert.equal(g.video.srcObject,null);
});

test('one decoded barcode stops camera before lookup, while expected misses keep scanning',async()=>{
  const f=fixture();await f.scanner.start();const cb=f.callback();
  cb(undefined,{getKind:()=> 'NotFoundException'});assert.equal(f.states.at(-1).phase,'scanning');
  cb({getText:()=> '737628064502'});cb({getText:()=> '737628064502'});
  assert.deepEqual(f.results,['737628064502']);assert.equal(f.counts().trackStops,1);assert.equal(f.counts().decodeStops,1);
});

test('fatal decoder errors are visible instead of silently ending the camera',async()=>{
  const f=fixture();await f.scanner.start();f.callback()(undefined,new Error('canvas failed'));
  assert.equal(f.states.at(-1).phase,'error');assert.match(f.states.at(-1).message,/scanner/i);
  assert.equal(f.counts().trackStops,1);assert.equal(f.video.srcObject,null);
});

test('startup timeouts release permission streams and decoder controls that arrive later',async()=>{
  let grant;const f=fixture({request:()=>new Promise(resolve=>grant=resolve)});
  await f.scanner.start();assert.equal(f.states.at(-1).phase,'error');assert.match(f.states.at(-1).message,/access did not finish/);
  grant(f.stream);await Promise.resolve();assert.equal(f.counts().trackStops,1);assert.equal(f.video.srcObject,null);
  let finishDecode;const g=fixture({decode:controls=>new Promise(resolve=>finishDecode=()=>resolve(controls))});
  await g.scanner.start();assert.equal(g.states.at(-1).phase,'error');assert.match(g.states.at(-1).message,/scanner did not start/);
  finishDecode();await Promise.resolve();await Promise.resolve();assert.equal(g.counts().decodeStops,1);assert.equal(g.counts().trackStops,1);
});
