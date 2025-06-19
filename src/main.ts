import './style.scss'

import * as THREE from "three";

const PX_TO_M=1/100;
const FOVY=45;
const FAR=1000;

const TRANSITION_DURATION=0.5;

function getCameraZ(height:number,fovyDeg:number):number{
  const fovy=THREE.MathUtils.degToRad(fovyDeg);
  const halfFovy=fovy/2;
  const t=Math.tan(halfFovy);
  const halfHeight=height/2;
  const z=halfHeight/t;
  return z;
}
function getBuildingHeight(ix:number,iz:number,heightMax:number,time:number){
  const heightMin=1;
  return (Math.sin(ix+time*0.)*0.5+0.5)*(Math.cos(iz+time)*0.5+0.5)*(heightMax-heightMin)+heightMin;
}

interface AppParams{
  viewFront:HTMLCanvasElement;
  viewBack:HTMLCanvasElement;
  elementForSize:HTMLElement;
  title:HTMLElement;
}

interface Size{
  width:number;
  height:number;
}

class App{
  viewFront:HTMLCanvasElement;
  viewBack:HTMLCanvasElement;
  elementForSize:HTMLElement;
  title:HTMLElement;
  threeEssentialObjects?:{
    rendererFront:THREE.WebGLRenderer,
    rendererBack:THREE.WebGLRenderer,
    camera:THREE.PerspectiveCamera,
    scene:THREE.Scene,
  };
  threeAdditionalObjects?:{
    objects:THREE.Object3D[];
    ground:THREE.Mesh,
    buildings:THREE.Mesh[],
    uza:THREE.Object3D;

  };
  constructor({viewFront,viewBack,elementForSize,title}:AppParams){
    this.viewFront=viewFront;
    this.viewBack=viewBack;
    this.elementForSize=elementForSize;
    this.title=title;
    this.setupThree();
    this.setupScene();
    this.setupEvents();
  }
  setupThree(){
    const {viewFront,viewBack}=this;
    const rendererFront=new THREE.WebGLRenderer({
      canvas:viewFront,
      alpha:true,
    });
    const rendererBack=new THREE.WebGLRenderer({
      canvas:viewBack,
      alpha:true,
    });
    const scene=new THREE.Scene();
    const size=this.getSize();
    const camera = new THREE.PerspectiveCamera( FOVY, size.width / size.height, 0.1, FAR );
    camera.position.z=5;
    
    const ambientLight=new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    const pointLight=new THREE.PointLight(0xffffff,1,100);
    console.log(pointLight);
    console.log(pointLight.position);
    pointLight.position.set(0,0,5);
    scene.add(pointLight);
    
    this.threeEssentialObjects={
      rendererFront,
      rendererBack,
      camera,
      scene,
    };
  }
  setupScene(){
    if(!this.threeEssentialObjects){
      throw new Error("this.threeEssentialObjects is null");
    }
    const {scene}=this.threeEssentialObjects;
    
    let objects=[0,-5,-10,-15,-20].map((y)=>{
      const geometry=new THREE.TorusKnotGeometry(0.5,0.2);
      const material=new THREE.MeshStandardMaterial( { color: 0x00ff00 } );
      const object=new THREE.Mesh( geometry, material );
      object.position.set(0,y,0);
      scene.add(object);
      return object;
    });
    
    let ground=null;
    {
      const geometry=new THREE.PlaneGeometry( 20, 20, 32 );
      geometry.rotateX(THREE.MathUtils.degToRad(-90));
      const material=new THREE.MeshStandardMaterial( { color: 0xffffff } );
      const mesh=new THREE.Mesh(geometry, material);
      scene.add(mesh);
      ground=mesh;
    }
    const buildings=[];
    const span=2;
    for(let iz=-10;iz<=1;++iz){
      const z=iz*span;
      for(let ix=-5;ix<=5;++ix){
        const x=ix*span;
        const geometry=new THREE.BoxGeometry(1,1,1);
        geometry.translate(0,0.5,0);
        const material=new THREE.MeshStandardMaterial( { color: 0xffffff } );
        const mesh=new THREE.Mesh(geometry, material);
        mesh.position.set(x,0,z);
        ground.add(mesh);
        const building=mesh;
        Object.assign(building.userData,{
          ix,
          iz,
        });
        
        buildings.push(building);
      }
    }

    let uza:THREE.Mesh;
    {
      const geometry = new THREE.ConeGeometry( 1, 2, 32 ); 
      const material = new THREE.MeshStandardMaterial( {color: 0xffff00} );
      uza = new THREE.Mesh(geometry, material );
      uza.userData.uzaRatio=0;
      scene.add( uza );
    }

    
    this.threeAdditionalObjects={
      objects,
      ground,
      buildings,
      uza,
    };
    
  }
  getSize():Size{
    // const width=window.innerWidth;
    // const height=window.innerHeight;
    const width=this.elementForSize.clientWidth;
    const height=this.elementForSize.clientHeight;

    return {
      width,
      height,
    }
  }
  getTitleSize():Size{
    const width=this.title.clientWidth;
    const height=this.title.clientHeight;

    return {
      width,
      height,
    }

  }
  setupEvents(){
    // window.addEventListener("resize",()=>{
    //   this.onResize();
    // });
    // this.onResize();

    let previousWidth:number|null=null;
    let previousHeight:number|null=null;
    
    let previousTimeMS=performance.now();
    const animate=(timeMS:number)=>{
      requestAnimationFrame(animate);
      const size=this.getSize();
      if(size.width!=previousWidth || size.height!=previousHeight){
        previousWidth=size.width;
        previousHeight=size.height;
        this.onResize();
      }
      // console.log(size.width,size.height);
      const deltaTimeMS=timeMS-previousTimeMS;


      this.onTick(timeMS/1000,deltaTimeMS/1000);
      previousTimeMS=timeMS;
    };
    animate(previousTimeMS);

  }
  onResize(){
    if(!this.threeEssentialObjects){
      throw new Error("this.threeEssentialObjects is null");
    }
    const {rendererFront,rendererBack,camera}=this.threeEssentialObjects;
    const {width,height}=this.getSize();
    rendererFront.setSize(width,height);
    rendererBack.setSize(width,height);
    const aspect=width/height;
    camera.aspect=aspect;
    camera.updateProjectionMatrix();
    
  }
  onTick(time:number,deltaTime:number){
    
    //console.log(time);
    this.update(time,deltaTime);
    this.render();
  }
  update(time:number,deltaTime:number){
    if(!this.threeAdditionalObjects){
      throw new Error("this.threeAdditionalObjects is null");
    }
    const{objects,buildings,uza}=this.threeAdditionalObjects;
    const size=this.getSize();
    const widthPx=size.width;
    const width=widthPx*PX_TO_M;
    for(let object of objects){
      object.rotation.x+=deltaTime*0.3;
      object.rotation.y+=deltaTime*1;
      object.position.x-=deltaTime*3;
      if(object.position.x<width*-0.5){
        object.position.x=width*0.5;
      }
    }
    // const heightPx=size.height;
    // const height=heightPx*PX_TO_M;
    const documentHeightPx=document.body.clientHeight;
    const documentHeight=documentHeightPx*PX_TO_M;
    for(let building of buildings){
      const {ix,iz}=building.userData;
      building.scale.y=getBuildingHeight(ix,iz,documentHeight,time);
    }

    const titleSize=this.getTitleSize();
    // console.log(titleSize.height,window.scrollY);
    if(window.scrollY <= titleSize.height){
      uza.userData.uzaRatio = Math.max(0,uza.userData.uzaRatio - deltaTime/TRANSITION_DURATION);
    }else{
      uza.userData.uzaRatio = Math.min(1,uza.userData.uzaRatio + deltaTime/TRANSITION_DURATION);
    }
    uza.rotation.x+=deltaTime*1;
    // console.log(uza.userData.uzaRatio);

  }
  render(){
    if(!this.threeEssentialObjects){
      throw new Error("this.threeEssentialObjects is null");
    }
    if(!this.threeAdditionalObjects){
      throw new Error("this.threeAdditionalObjects is null");
    }
    const {rendererFront,rendererBack,scene,camera}=this.threeEssentialObjects;
    const {ground,uza}=this.threeAdditionalObjects;
    const size=this.getSize();
    const heightPx=size.height;
    const height=heightPx*PX_TO_M;
    const cameraZ=getCameraZ(height,FOVY);
    camera.position.z=cameraZ;
    camera.position.y=window.scrollY*-1*PX_TO_M;
    
    const documentHeightPx=document.body.clientHeight;
    const documentHeight=documentHeightPx*PX_TO_M;
    ground.position.y=(documentHeight+height*-0.5)*-1;

    {
      const normalPosition = new THREE.Vector3(0,0,-10);
      const uzaPosition = new THREE.Vector3(size.width * 0.3 * PX_TO_M,(window.scrollY + size.height*0.3)*-1*PX_TO_M,0);
      const uzaRatio=uza.userData.uzaRatio as number;

      const p=normalPosition.clone().lerp(uzaPosition,uzaRatio);

      uza.position.copy(p);

    }
    
    //render foreground
    camera.far=cameraZ;
    camera.updateProjectionMatrix();
    rendererFront.render(scene,camera);
    //render background
    camera.far=cameraZ+FAR;
    camera.updateProjectionMatrix();
    rendererBack.render(scene,camera);
  }
}

window.addEventListener("load",()=>{
  const viewFront=document.querySelector<HTMLCanvasElement>(".my-block__canvas--front")!;
  const viewBack=document.querySelector<HTMLCanvasElement>(".my-block__canvas--back")!;
  const elementForSize=document.querySelector<HTMLElement>(".dummy-for-size")!;
  const title=document.querySelector<HTMLElement>(".my-dom__title")!;
  (window as any).app=new App({viewFront,viewBack,elementForSize,title});
});


