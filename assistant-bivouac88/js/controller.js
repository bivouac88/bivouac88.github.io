// controller.js — éditeur visuel de scénarios Bivouac88 (JSON v2)
// Remplace l'ancien contrôleur. Le format consommé par scene-reader.js reste inchangé.
(function () {
  if (new URLSearchParams(location.search).get('edit') !== 'bivouac88admin') return;
  if (document.getElementById('ctrl-panel')) return;

  const clone = value => JSON.parse(JSON.stringify(value));
  const num = value => value === '' || value == null ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  const round = value => Math.round(value * 100) / 100;
  const PAGES = [['test','Index'],['accueil','Résumé'],['stats','Stats'],['etapes','Étapes'],['journal','Journal de bord'],['meteo-peche','Météo & pêche'],['poi','POI']];
  const DEVICES = [['pc','PC'],['mobile','Mobile']];
  const TRIGGERS = [
    ['manual','Uniquement appelée par une autre scène'],['load','Au chargement de la page'],['avatar-click',"Au clic sur l'avatar"],
    ['enter',"Quand un élément entre à l'écran"],['scroll','À un niveau de défilement'],
    ['element-click','Au clic sur un élément'],['hover','Au survol d’un élément'],
    ['idle','Après une période d’inactivité'],['after-scene','Après une autre scène'],['event','Sur événement personnalisé']
  ];
  const savedData = window.B88_SCENES_DATA || {version:2,scenes:[]};
  let scenes = Array.isArray(savedData.scenes) ? clone(savedData.scenes) : [];
  let editingId = null;
  let ANIMATIONS = Array.isArray(window.characterAnimations) ? window.characterAnimations.slice() : [];
  let currentAnimation = ANIMATIONS[0] || 'Angry';
  let draftSteps = [];
  let draftPoints = {};
  let currentRotation = {x:0,y:0,z:0};
  let picking = null;

  const panel = document.createElement('aside');
  panel.id = 'ctrl-panel';
  Object.assign(panel.style,{position:'fixed',right:'14px',top:'14px',width:'360px',maxWidth:'calc(100vw - 28px)',maxHeight:'calc(100vh - 28px)',overflow:'auto',zIndex:10001,background:'#191713f5',color:'#eee',border:'1px solid #e58e26',borderRadius:'10px',padding:'12px',font:'13px Arial,sans-serif',boxShadow:'0 8px 30px #0009',boxSizing:'border-box'});
  // Position du panneau mémorisée localement, avec déplacement par glisser-déposer.
  const PANEL_POSITION_KEY = 'b88-admin-panel-position';
  try {
    const savedPosition = JSON.parse(localStorage.getItem(PANEL_POSITION_KEY) || 'null');
    if (savedPosition && Number.isFinite(savedPosition.x) && Number.isFinite(savedPosition.y)) {
      panel.style.left = `${savedPosition.x}px`;
      panel.style.top = `${savedPosition.y}px`;
      panel.style.right = 'auto';
    }
  } catch (_) {}

  const style = document.createElement('style');
  style.textContent = `#ctrl-panel *{box-sizing:border-box}#ctrl-panel input,#ctrl-panel select,#ctrl-panel textarea{width:100%;background:#2a2520;color:#eee;border:1px solid #514638;border-radius:5px;padding:7px;font:inherit}#ctrl-panel button{cursor:pointer;border:1px solid #514638;border-radius:5px;padding:7px 9px;background:#302a23;color:#eee;font:inherit}#ctrl-panel button.primary{background:#e58e26;color:#17120c;border-color:#e58e26;font-weight:bold}#ctrl-panel button.danger{border-color:#8a3b2e;color:#ffb3a8}#ctrl-panel .muted{color:#aaa;font-size:11px}#ctrl-panel .field{display:grid;gap:4px;margin:8px 0}#ctrl-panel .field>label{color:#c7b9a5;font-size:11px}#ctrl-panel .row{display:flex;gap:7px;align-items:center}#ctrl-panel .row>*{min-width:0;flex:1}#ctrl-panel .card{border:1px solid #514638;background:#211e19;border-radius:7px;padding:9px;margin:7px 0}#ctrl-panel .pill{display:inline-block;border-radius:20px;padding:3px 7px;background:#383126;color:#e9bd7c;font-size:10px}#ctrl-panel .step{border-left:3px solid #e58e26;padding:7px 8px;margin:7px 0;background:#242019;border-radius:4px}#ctrl-panel .checkgrid{display:grid;grid-template-columns:1fr 1fr;gap:5px}#ctrl-panel .checkgrid label{display:flex;gap:6px;align-items:center;font-size:12px}#ctrl-panel .checkgrid input{width:auto}`;
  document.head.appendChild(style);

  const el = (tag, text, cls) => { const node=document.createElement(tag); if(text!==undefined) node.textContent=text; if(cls) node.className=cls; return node; };
  const button = (text, fn, cls='') => { const b=el('button',text,cls); b.type='button'; b.addEventListener('click',fn); return b; };
  const field = (label, control) => { const wrap=el('div',undefined,'field'); wrap.append(el('label',label),control); return wrap; };
  const input = (type='text', value='', placeholder='') => { const i=el('input'); i.type=type; i.value=value ?? ''; i.placeholder=placeholder; return i; };
  const select = (options, value) => { const s=el('select'); options.forEach(([v,t])=>{const o=el('option',t);o.value=v;s.append(o)}); if(value!==undefined)s.value=value; return s; };
  const heading = text => { const h=el('h3',text); Object.assign(h.style,{fontSize:'13px',color:'#e58e26',margin:'15px 0 6px'}); return h; };
  const help = text => el('div',text,'muted');
  const line = () => { const d=el('div'); d.style.borderTop='1px solid #40382e'; d.style.margin='10px 0'; return d; };

  const header=el('div'); Object.assign(header.style,{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'8px'});
  const title=el('strong','🧭 Éditeur de scénarios'); title.style.color='#e58e26';
  const collapse=button('Réduire',()=>{body.hidden=!body.hidden;collapse.textContent=body.hidden?'Ouvrir':'Réduire';});
  header.append(title,collapse); panel.append(header);
  header.style.cursor = 'move';
  header.style.touchAction = 'none';
  header.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('button')) return;
    const startX=event.clientX, startY=event.clientY;
    const startLeft=panel.getBoundingClientRect().left, startTop=panel.getBoundingClientRect().top;
    let moved=false;
    const move=e=>{
      const dx=e.clientX-startX, dy=e.clientY-startY;
      if(Math.hypot(dx,dy)>4) moved=true;
      if(!moved)return;
      const maxX=Math.max(0,innerWidth-panel.offsetWidth), maxY=Math.max(0,innerHeight-40);
      const x=Math.max(0,Math.min(maxX,startLeft+dx)), y=Math.max(0,Math.min(maxY,startTop+dy));
      Object.assign(panel.style,{left:x+'px',top:y+'px',right:'auto'});
    };
    const stop=()=>{
      document.removeEventListener('pointermove',move);
      document.removeEventListener('pointerup',stop);
      document.removeEventListener('pointercancel',stop);
      if(moved){try{localStorage.setItem(PANEL_POSITION_KEY,JSON.stringify({x:panel.offsetLeft,y:panel.offsetTop}));}catch(_){}}
    };
    document.addEventListener('pointermove',move);
    document.addEventListener('pointerup',stop);
    document.addEventListener('pointercancel',stop);
  });
  const body=el('div'); panel.append(body);

  // Zone de statut
  const status=el('div','Prêt. Les modifications sont en mémoire jusqu’à l’export.','muted'); status.style.margin='8px 0'; body.append(status);
  const tabs=el('div'); tabs.className='row'; tabs.style.margin='10px 0';
  const overviewTab=button('① Scénarios',()=>showView('overview'),'primary');
  const editorTab=button('② Éditeur',()=>showView('editor'));
  const checkTab=button('③ Vérifier / exporter',()=>showView('check'));
  const toolsTab=button('④ Outils personnage',()=>showView('tools'));
  tabs.append(overviewTab,editorTab,checkTab,toolsTab); body.append(tabs);
  const view=el('div'); body.append(view);

  // État du formulaire
  const name=input('text','','Ex. Accueil, Réponse au clic…');
  const priority=input('number','0');
  const pageChecks={}, deviceChecks={};
  const triggerType=select(TRIGGERS,'avatar-click');
  const triggerDelay=input('number','0');
  const triggerSelector=input('text','','Sélecteur CSS, ex. #photos');
  const triggerValue=input('text','');
  const triggerAfterScene=select([['','— Choisir la scène précédente —']], '');
  const triggerLeave=select([['hold','Conserver la scène'],['stop','Arrêter la scène']], 'hold');
  const frequency=select([['always','À chaque fois'],['load','Une fois par chargement'],['session','Une fois par session'],['visitor','Une fois par visiteur']],'always');
  const cooldown=input('number','0');
  const interruptible=document.createElement('input'); interruptible.type='checkbox'; interruptible.checked=true;
  const endAction=select([['hold','Terminer ici'],['chain','Enchaîner vers une autre scène']],'hold');
  const endNext=select([['','— Choisir la scène suivante —']], '');
  const repeat=input('number','1');
  const animationSelect=select([],currentAnimation);
  const duration=input('number','','Vide = durée illimitée / jusqu’à la suite');
  const pause=input('number','0');
  const movement=select([['instant','Déplacement instantané'],['walk','Marcher jusqu’au point']],'instant');
  const walkSpeed=input('number','200');
  const walkAnimation=select([], 'Running');
  const autoFace=document.createElement('input'); autoFace.type='checkbox'; autoFace.checked=true;
  const stepsHost=el('div');
  const pointsHost=el('div');
  const positionMode=select([['screen','Position fixe à l’écran'],['anchor','Position liée à un élément']], 'screen');
  const anchorBehavior=select([['follow','Suivre l’élément pendant le scroll'],['screen','Capturer sa position une seule fois']], 'follow');
  let selectedAnchor=null;
  const anchorInfo=el('div','Aucun élément sélectionné.','muted');
  const nameOf = id => scenes.find(s=>Number(s.id)===Number(id))?.name || `Scène #${id}`;

  function refreshAnimationLists(){
    const names=Array.isArray(window.characterAnimations)&&window.characterAnimations.length?window.characterAnimations:ANIMATIONS;
    [animationSelect,walkAnimation].forEach(s=>{const old=s.value;s.replaceChildren();names.forEach(n=>{const o=el('option',n.replace(/_/g,' '));o.value=n;s.append(o)});if(names.includes(old))s.value=old;});
    if(names.includes(currentAnimation)) animationSelect.value=currentAnimation;
  }
  document.addEventListener('b88:animations-ready', event => {
    if (Array.isArray(event.detail?.animations)) {
      ANIMATIONS = event.detail.animations.slice();
      window.characterAnimations = ANIMATIONS;
    }
    refreshAnimationLists();
  });
  refreshAnimationLists();
  animationSelect.addEventListener('change',()=>{currentAnimation=animationSelect.value;window.characterPlay?.(currentAnimation)});

  function makeCheckGrid(items, state){
    const grid=el('div');grid.className='checkgrid';
    items.forEach(([value,label],idx)=>{const l=el('label');const c=el('input');c.type='checkbox';c.checked=state[value]??(idx===0);state[value]=c.checked;c.addEventListener('change',()=>state[value]=c.checked);l.append(c,el('span',label));grid.append(l)});
    return grid;
  }
  function cssPath(node){
    if(!node||node===document.body)return null;
    const parts=[];let n=node;
    while(n&&n.nodeType===1&&n!==document.body){if(n.id){parts.unshift('#'+CSS.escape(n.id));break;}let p=n.tagName.toLowerCase();const classes=[...n.classList].filter(c=>!c.startsWith('b88-')).slice(0,2);if(classes.length)p+='.'+classes.map(CSS.escape).join('.');const parent=n.parentElement;if(parent){const same=[...parent.children].filter(x=>x.tagName===n.tagName);if(same.length>1)p+=`:nth-of-type(${same.indexOf(n)+1})`;}parts.unshift(p);n=n.parentElement;}
    return parts.join(' > ');
  }
  function chooseElement(callback){status.textContent='Clique sur un élément de la page…';picking=callback;document.body.style.cursor='crosshair';}
  document.addEventListener('click',event=>{if(!picking||panel.contains(event.target))return;event.preventDefault();event.stopPropagation();const target=document.elementsFromPoint(event.clientX,event.clientY).find(n=>!n.closest('#ctrl-panel,#b88-character,.b88-dialogue'));const cb=picking;picking=null;document.body.style.cursor='';if(target)cb(target);status.textContent='Élément sélectionné.';},true);

  function capturePoint(){
    const p=window.characterGetPosition?.()||{x:innerWidth-120,y:6};
    const point={
      selector:null, ax:null, ay:null, offsetX:0, offsetY:0,
      mode: positionMode.value==='anchor' ? anchorBehavior.value : 'screen',
      fallback:{xPct:round(p.x/Math.max(1,innerWidth)*100),yPct:round(p.y/Math.max(1,innerHeight)*100)}
    };
    if(positionMode.value==='anchor'){
      if(!selectedAnchor){status.textContent='Choisis d’abord l’élément auquel attacher le personnage.';return null;}
      const r=selectedAnchor.getBoundingClientRect();
      if(!r.width||!r.height){status.textContent='L’élément sélectionné n’a pas de dimensions utilisables.';return null;}
      point.selector=cssPath(selectedAnchor);
      point.ax=round((p.x-r.left)/r.width*100);
      point.ay=round(((innerHeight-p.y)-r.top)/r.height*100);
    }
    const key='P'+(Object.keys(draftPoints).length+1);
    draftPoints[key]=point;
    return key;
  }
  function updatePositionMode(){
    const anchored=positionMode.value==='anchor';
    if(anchorBehavior.parentElement)anchorBehavior.parentElement.style.display=anchored?'grid':'none';
    anchorPickButton.style.display=anchored?'block':'none';
    anchorInfo.style.display=anchored?'block':'none';
    if(!anchored){selectedAnchor=null;anchorInfo.textContent='Position fixe : aucun élément de la page ne sera suivi.';}
  }
  const anchorPickButton=button('🎯 Choisir l’élément de la page',()=>chooseElement(node=>{
    selectedAnchor=node;
    anchorInfo.textContent='Élément choisi : '+(node.id?'#'+node.id:node.tagName.toLowerCase()+(node.classList.length?'.'+[...node.classList].slice(0,2).join('.'):''));
    status.textContent='Élément d’ancrage sélectionné.';
  }));
  positionMode.addEventListener('change',updatePositionMode);
  updatePositionMode();

  function refreshSteps(){
    stepsHost.replaceChildren();
    if(!draftSteps.length){stepsHost.append(help('Aucune étape pour le moment.'));return;}
    draftSteps.forEach((step,index)=>{const card=el('div',undefined,'step');const top=el('div',`${index+1}. ${step.animation} — ${step.at}`);top.style.fontWeight='bold';card.append(top);const point=draftPoints[step.at]||{};const positionLabel=point.selector?(point.mode==='follow'?'Élément suivi au scroll':'Élément capturé une fois'):'Position fixe à l’écran';card.append(help(`${positionLabel} · Durée : ${step.duration==null?'sans limite / jusqu’à la suite':step.duration+' s'} · Pause : ${step.pause||0} s · ${step.move?.type==='walk'?'Marche':'Instantané'}`));const actions=el('div');actions.className='row';actions.style.marginTop='6px';actions.append(button('↑',()=>{if(index){[draftSteps[index-1],draftSteps[index]]=[draftSteps[index],draftSteps[index-1]];refreshSteps();}}),button('↓',()=>{if(index<draftSteps.length-1){[draftSteps[index+1],draftSteps[index]]=[draftSteps[index],draftSteps[index+1]];refreshSteps();}}),button('Supprimer',()=>{draftSteps.splice(index,1);refreshSteps();},'danger'));card.append(actions);stepsHost.append(card);});
  }
  function addStep(){
    const at=capturePoint();
    if(!at)return;
    const offsets=readFieldOffsets();
    const step={animation:animationSelect.value||currentAnimation,at,duration:num(duration.value),pause:num(pause.value)??0,move:{type:movement.value},rotation:{...currentRotation},autoFace:false,bubble:offsets.bubble,form:offsets.form};
    if(movement.value==='walk'){step.move.speed=num(walkSpeed.value)||200;step.move.walkAnimation=walkAnimation.value;step.autoFace=autoFace.checked;}
    draftSteps.push(step);refreshSteps();status.textContent=`Étape ${draftSteps.length} ajoutée au scénario.`;
  }

  function refreshAfterSceneOptions(selected=''){
    triggerAfterScene.replaceChildren();triggerAfterScene.append(new Option('— Choisir la scène précédente —',''));
    scenes.filter(s=>Number(s.id)!==Number(editingId)).forEach(s=>triggerAfterScene.append(new Option(`${s.name||'Sans nom'} (scénario #${s.id})`,String(s.id))));
    triggerAfterScene.value=selected==null?'':String(selected);
  }
  function refreshChainOptions(selected=''){
    endNext.replaceChildren();endNext.append(new Option('— Choisir la scène suivante —',''));
    scenes.filter(s=>Number(s.id)!==Number(editingId)).forEach(s=>endNext.append(new Option(`${s.name||'Sans nom'} (scénario #${s.id})`,String(s.id))));
    endNext.value=selected==null?'':String(selected);
    refreshAfterSceneOptions(triggerAfterScene.value);
  }
  function resetEditor(){
    editingId=null;name.value='';priority.value='0';currentRotation={x:0,y:0,z:0};currentAnimation=ANIMATIONS[0]||'Angry';if([...animationSelect.options].some(o=>o.value===currentAnimation))animationSelect.value=currentAnimation;Object.keys(pageChecks).forEach(k=>pageChecks[k]=k==='test');Object.keys(deviceChecks).forEach(k=>deviceChecks[k]=k==='pc');
    triggerType.value='avatar-click';triggerDelay.value='0';triggerSelector.value='';triggerValue.value='';triggerAfterScene.value='';triggerLeave.value='hold';frequency.value='always';cooldown.value='0';interruptible.checked=true;positionMode.value='screen';selectedAnchor=null;anchorInfo.textContent='Position fixe : aucun élément de la page ne sera suivi.';updatePositionMode();
    endAction.value='hold';repeat.value='1';refreshChainOptions('');draftPoints={};draftSteps=[];refreshSteps();
  }
  function loadScene(scene){
    editingId=scene.id;name.value=scene.name||'';priority.value=scene.priority??0;
    if(scene.steps?.length){
      const lastStep=scene.steps[scene.steps.length-1];
      if(lastStep.rotation) currentRotation={x:Number(lastStep.rotation.x)||0,y:Number(lastStep.rotation.y)||0,z:Number(lastStep.rotation.z)||0};
      if(lastStep.animation){
        currentAnimation=lastStep.animation;
        if([...animationSelect.options].some(o=>o.value===currentAnimation)) animationSelect.value=currentAnimation;
      }
    }
    PAGES.forEach(([v])=>pageChecks[v]=(scene.pages||[]).includes(v));DEVICES.forEach(([v])=>deviceChecks[v]=(scene.devices||[]).includes(v));
    triggerType.value=scene.trigger?.type||'load';triggerDelay.value=scene.trigger?.delay??0;triggerSelector.value=scene.trigger?.selector||'';triggerLeave.value=scene.trigger?.leave||'hold';
    const t=scene.trigger||{};triggerValue.value=t.threshold??t.scrollPct??t.idleSeconds??t.eventName??'';refreshAfterSceneOptions(t.afterScene);positionMode.value='screen';selectedAnchor=null;anchorInfo.textContent='Choisis un nouvel élément si tu ajoutes une étape liée à un élément.';updatePositionMode();
    frequency.value=scene.conditions?.frequency||'always';cooldown.value=scene.conditions?.cooldownSeconds??0;interruptible.checked=scene.conditions?.interruptible!==false;
    endAction.value=scene.end?.action||'hold';repeat.value=scene.end?.repeat??1;refreshChainOptions(scene.end?.next);
    draftPoints=clone(scene.points||{});draftSteps=clone(scene.steps||[]);refreshSteps();showView('editor');
  }
  function collectScene(){
    const pages=PAGES.filter(([v])=>pageChecks[v]).map(([v])=>v),devices=DEVICES.filter(([v])=>deviceChecks[v]).map(([v])=>v);
    if(!name.value.trim()){status.textContent='Donne un nom à ce scénario.';return null;}
    if(!pages.length||!devices.length){status.textContent='Sélectionne au moins une page et un appareil.';return null;}
    if(!draftSteps.length){status.textContent='Ajoute au moins une étape.';return null;}
    const type=triggerType.value,trigger={type,delay:num(triggerDelay.value)??0};
    if(['enter','element-click','hover'].includes(type)){if(!triggerSelector.value.trim()){status.textContent='Ce déclencheur nécessite un élément CSS.';return null;}trigger.selector=triggerSelector.value.trim();}
    if(type==='enter')trigger.threshold=num(triggerValue.value)??0.5;
    if(type==='scroll')trigger.scrollPct=num(triggerValue.value)??50;
    if(type==='idle')trigger.idleSeconds=num(triggerValue.value)??10;
    if(type==='after-scene'){if(!triggerAfterScene.value){status.textContent='Choisis la scène qui doit se terminer avant celle-ci.';return null;}trigger.afterScene=Number(triggerAfterScene.value);}
    if(type==='event'){if(!triggerValue.value.trim()){status.textContent='Indique le nom de l’événement.';return null;}trigger.eventName=triggerValue.value.trim();}
    if(['enter','scroll','hover'].includes(type))trigger.leave=triggerLeave.value;
    const chain=endAction.value==='chain';if(chain&&!endNext.value){status.textContent='Choisis la scène qui suit.';return null;}
    const old=scenes.find(s=>Number(s.id)===Number(editingId));
    const id=editingId??(scenes.reduce((m,s)=>Math.max(m,Number(s.id)||0),0)+1);
    return {...(old||{}),id,name:name.value.trim(),enabled:true,priority:num(priority.value)??0,pages,devices,trigger,conditions:{frequency:frequency.value,cooldownSeconds:num(cooldown.value)??0,interruptible:interruptible.checked},points:clone(draftPoints),steps:clone(draftSteps),end:{action:chain?'chain':'hold',next:chain?Number(endNext.value):null,repeat:num(repeat.value)??1},recorded:{viewport:{width:innerWidth,height:innerHeight},scrollY:scrollY,date:new Date().toISOString()}};
  }

  function renderOverview(){
    view.replaceChildren();view.append(heading('Déroulement de tes scénarios'),help('Les cartes marquées « Départ » se lancent seules. Les autres sont appelées par une scène précédente.'));
    if(!scenes.length){view.append(help('Aucun scénario. Clique sur « Nouveau scénario » pour commencer.'));view.append(button('+ Nouveau scénario',()=>{resetEditor();showView('editor');},'primary'));return;}
    scenes.slice().sort((a,b)=>Number(a.id)-Number(b.id)).forEach(scene=>{
      const card=el('div',undefined,'card');const start=scene.trigger?.type==='manual'?'Appelée uniquement par une autre scène':scene.trigger?.type==='load'?'Départ au chargement':scene.trigger?.type==='avatar-click'?'Départ au clic avatar':`Déclencheur : ${TRIGGERS.find(t=>t[0]===scene.trigger?.type)?.[1]||scene.trigger?.type}`;
      const incoming=scenes.filter(source=>source.end?.action==='chain'&&Number(source.end.next)===Number(scene.id));
      card.append(el('strong',scene.name||`Scénario #${scene.id}`),el('div',`${start} · ${(scene.pages||[]).map(p=>PAGES.find(x=>x[0]===p)?.[1]||p).join(', ')}`,'muted'));
      if(incoming.length)card.append(el('div','Reçoit un enchaînement depuis : '+incoming.map(x=>x.name||'Scénario #'+x.id).join(', '),'muted'));
      if(incoming.length&&scene.trigger?.type!=='manual')card.append(el('div','⚠ Possède aussi son propre déclencheur : elle peut démarrer indépendamment.','muted'));
      card.append(el('div',`${(scene.steps||[]).length} étape(s) · ${scene.end?.action==='chain'?'Enchaîne vers '+nameOf(scene.end.next):'Termine ici'}`,'pill'));
      const actions=el('div');actions.className='row';actions.style.marginTop='8px';actions.append(button('▶ Aperçu',()=>window.b88PlayScene?.(clone(scene))),button('Modifier',()=>loadScene(scene)),button('Supprimer',()=>{if(confirm(`Supprimer « ${scene.name} » ?`)){scenes=scenes.filter(s=>s.id!==scene.id);renderOverview();}} ,'danger'));card.append(actions);view.append(card);
    });
    view.append(button('+ Nouveau scénario',()=>{resetEditor();showView('editor');},'primary'));
  }

  function renderEditor(){
    view.replaceChildren();view.append(heading(editingId==null?'Créer un scénario':'Modifier : '+(name.value||'scénario')));
    view.append(field('Nom du scénario',name));view.append(field('Priorité (si plusieurs départs concurrents)',priority));
    view.append(heading('1. Où et quand ça démarre'));
    view.append(field('Pages concernées',makeCheckGrid(PAGES,pageChecks)));view.append(field('Appareils',makeCheckGrid(DEVICES,deviceChecks)));
    view.append(field('Déclencheur',triggerType));view.append(field('Délai avant démarrage (secondes)',triggerDelay));
    const triggerOptions=el('div');triggerOptions.append(field('Élément concerné (clic / survol / visibilité)',triggerSelector),button('🎯 Choisir cet élément sur la page',()=>chooseElement(node=>{triggerSelector.value=cssPath(node)||'body';})),field('Valeur (seuil, secondes ou événement)',triggerValue),field('Scène précédente',triggerAfterScene),field('Quand il sort / n’est plus actif',triggerLeave));view.append(triggerOptions);
    const refreshTriggerFields=()=>{const type=triggerType.value;triggerOptions.style.display=['enter','scroll','element-click','hover','idle','after-scene','event'].includes(type)?'block':'none';triggerSelector.parentElement.style.display=['enter','element-click','hover'].includes(type)?'grid':'none';triggerLeave.parentElement.style.display=['enter','scroll','hover'].includes(type)?'grid':'none';triggerValue.parentElement.style.display=['enter','scroll','idle','event'].includes(type)?'grid':'none';triggerAfterScene.parentElement.style.display=type==='after-scene'?'grid':'none';if(type==='event'){triggerValue.type='text';triggerValue.placeholder='Nom de l’événement';}else{triggerValue.type='number';triggerValue.placeholder='Valeur';}};triggerType.onchange=refreshTriggerFields;refreshTriggerFields();
    view.append(heading('2. Construire le déroulement'));
    view.append(help('Une étape mémorise la position, l’animation, l’orientation et le placement des champs de dialogue.'));
    view.append(field('Type de position',positionMode));
    view.append(help('Fixe à l’écran : reste au même endroit pendant le défilement. Liée à un élément : se place par rapport à un élément précis de la page.'));
    view.append(field('Comportement pendant le défilement',anchorBehavior));
    view.append(anchorPickButton,anchorInfo);
    updatePositionMode();
    view.append(field('Animation',animationSelect));
    view.append(field('Durée (secondes)',duration));view.append(help('Laisse vide pour ne pas imposer de durée. Ce n’est pas une erreur.'));
    view.append(field('Pause avant cette étape (secondes)',pause));view.append(field('Déplacement vers le point',movement));
    const walkOptions=el('div');walkOptions.append(field('Vitesse (px/s)',walkSpeed),field('Animation de marche',walkAnimation));const faceRow=el('label','');faceRow.style.display='flex';faceRow.style.gap='6px';faceRow.style.alignItems='center';faceRow.append(autoFace,el('span','Orienter le personnage dans le sens de la marche'));walkOptions.append(faceRow);view.append(walkOptions);const refreshMove=()=>walkOptions.style.display=movement.value==='walk'?'block':'none';movement.onchange=refreshMove;refreshMove();
    const place=button('📍 Activer le placement du personnage',()=>{status.textContent='Clique sur la page pour placer le personnage.';const listener=e=>{if(panel.contains(e.target))return;window.characterMoveTo?.(e.clientX,innerHeight-e.clientY);document.removeEventListener('click',listener,true);status.textContent='Position mise à jour.';};document.addEventListener('click',listener,true);});
    const play=button('▶ Jouer cette animation',()=>window.characterPlay?.(animationSelect.value));const actionRow=el('div');actionRow.className='row';actionRow.append(place,play);view.append(actionRow);
    view.append(button('+ Ajouter cette étape à la séquence',addStep,'primary'));view.append(stepsHost);
    view.append(heading('3. Fin du scénario'));
    view.append(field('Après la dernière étape',endAction));view.append(field('Enchaîner vers',endNext));const refreshEnd=()=>{endNext.parentElement.style.display=endAction.value==='chain'?'grid':'none';};endAction.onchange=refreshEnd;refreshEnd();
    view.append(field('Répétitions (1 = une fois, 0 = boucle)',repeat));view.append(field('Fréquence',frequency));view.append(field('Délai minimum entre deux lancements (secondes)',cooldown));const interruptLabel=el('label');interruptLabel.style.display='flex';interruptLabel.style.gap='7px';interruptLabel.style.alignItems='center';interruptLabel.append(interruptible,el('span','Peut être interrompu par une autre scène'));view.append(interruptLabel);
    const actions=el('div');actions.className='row';actions.style.marginTop='12px';actions.append(button(editingId==null?'Enregistrer le scénario':'Mettre à jour le scénario',()=>{const scene=collectScene();if(!scene)return;const index=scenes.findIndex(s=>Number(s.id)===Number(scene.id));if(index<0)scenes.push(scene);else scenes[index]=scene;editingId=scene.id;refreshChainOptions(scene.end.next);status.textContent=`« ${scene.name} » enregistré en mémoire.`;showView('overview');},'primary'),button('Nouveau / vider',()=>{if(confirm('Abandonner les modifications non enregistrées ?')){resetEditor();showView('editor');}}));view.append(actions);
    refreshChainOptions(endNext.value);
  }

  function validate(){
    const errors=[],warnings=[];const ids=new Set();
    scenes.forEach(s=>{
      const label=s.name||`Scénario #${s.id}`;
      if(!Number.isInteger(Number(s.id))||ids.has(Number(s.id)))errors.push(`${label} : identifiant invalide ou doublon.`);ids.add(Number(s.id));
      if(!s.steps?.length)errors.push(`${label} : aucune étape.`);
      (s.steps||[]).forEach((step,i)=>{
        if(!step.at||!s.points?.[step.at]) errors.push(`${label}, étape ${i+1} : point absent.`);
        else {
          const point=s.points[step.at];
          if(point.selector){try{document.querySelector(point.selector);}catch(e){warnings.push(`${label}, étape ${i+1} : sélecteur CSS invalide.`);}}
          if(!point.fallback||!Number.isFinite(Number(point.fallback.xPct))||!Number.isFinite(Number(point.fallback.yPct))) errors.push(`${label}, étape ${i+1} : position de secours invalide.`);
        }
        if(!step.animation) errors.push(`${label}, étape ${i+1} : animation absente.`);
        if(step.duration!=null&&(!Number.isFinite(Number(step.duration))||Number(step.duration)<0)) errors.push(`${label}, étape ${i+1} : durée invalide.`);
        if(step.pause!=null&&(!Number.isFinite(Number(step.pause))||Number(step.pause)<0)) errors.push(`${label}, étape ${i+1} : pause invalide.`);
        if(step.move?.type==='walk'&&step.move.speed!=null&&(!Number.isFinite(Number(step.move.speed))||Number(step.move.speed)<=0)) errors.push(`${label}, étape ${i+1} : vitesse de marche invalide.`);
      });
      const repetitions=Number(s.end?.repeat??1);
      if(!Number.isInteger(repetitions)||repetitions<0) errors.push(`${label} : nombre de répétitions invalide.`);
      if(s.trigger?.type==='after-scene'&&!scenes.some(x=>Number(x.id)===Number(s.trigger.afterScene))) errors.push(`${label} : la scène déclencheuse n’existe plus.`);
      if(s.end?.action==='chain'){const next=scenes.find(x=>Number(x.id)===Number(s.end.next));if(!next)errors.push(`${label} : la scène suivante n’existe plus.`);else{if(!(s.pages||[]).some(p=>(next.pages||[]).includes(p)))errors.push(`${label} : la scène suivante ne partage aucune page avec elle.`);if(!(s.devices||[]).some(d=>(next.devices||[]).includes(d)))errors.push(`${label} : la scène suivante ne partage aucun appareil avec elle.`);}}
      if(s.trigger?.type==='manual'&&!scenes.some(source=>source.end?.action==='chain'&&Number(source.end.next)===Number(s.id)))warnings.push(`${label} : mode « appelée uniquement » mais aucun scénario ne l’appelle.`);
      if(scenes.some(source=>source.end?.action==='chain'&&Number(source.end.next)===Number(s.id))&&s.trigger?.type!=='manual')warnings.push(`${label} : elle est appelée par une autre scène mais garde aussi un déclencheur indépendant.`);
      if(s.end?.action==='chain'&&Number(s.end.next)===Number(s.id))warnings.push(`${label} : s’enchaîne vers elle-même (boucle).`);
      if(s.trigger?.type==='load')warnings.push(`${label} : démarre automatiquement au chargement.`);
    });
    return {errors,warnings};
  }
  function renderCheck(){
    view.replaceChildren();view.append(heading('Vérification du JSON v2'));
    const result=validate();
    if(!result.errors.length)view.append(el('div','✓ Aucune erreur bloquante.','pill'));else{view.append(el('strong',`${result.errors.length} erreur(s)`));result.errors.forEach(x=>view.append(el('div','✕ '+x,'muted')));}
    if(result.warnings.length){view.append(heading('À vérifier'));result.warnings.forEach(x=>view.append(el('div','⚠ '+x,'muted')));}
    view.append(heading('Chaînes détectées'));
    scenes.forEach(s=>view.append(el('div',`${s.name||'#'+s.id}  →  ${s.end?.action==='chain'?nameOf(s.end.next):'Fin'}`,'card')));
    const exportBtn=button('Exporter scenes-v2.json',()=>{const v=validate();if(v.errors.length){alert('Export annulé :\n\n'+v.errors.join('\n'));return;}if(v.warnings.length&&!confirm('Avertissements :\n\n'+v.warnings.join('\n')+'\n\nExporter quand même ?'))return;const data={version:2,exportedAt:new Date().toISOString(),avatar:{...(savedData.avatar||{}),hitbox:{...hitbox}},scenes};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='scenes-v2.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);status.textContent='JSON exporté. Remplace le fichier scenes-v2.json sur ton site.';},'primary');view.append(exportBtn);
    const importInput=input('file');importInput.accept='.json,application/json';importInput.addEventListener('change',async()=>{const file=importInput.files?.[0];if(!file)return;try{const data=JSON.parse(await file.text());if(data.version!==2||!Array.isArray(data.scenes))throw new Error('Format JSON v2 non reconnu.');if(!confirm(`Remplacer les ${scenes.length} scénarios en mémoire par les ${data.scenes.length} du fichier ?`))return;scenes=clone(data.scenes);savedData.avatar=data.avatar||{};if(data.avatar?.hitbox){hitbox={...hitboxDefaults,...data.avatar.hitbox};try{localStorage.setItem(HITBOX_KEY,JSON.stringify(hitbox));}catch(e){}}refreshChainOptions();status.textContent='JSON importé en mémoire.';showView('overview');}catch(e){alert('Import impossible : '+e.message);}});view.append(field('Importer un JSON v2 existant',importInput));
  }
  // Outils conservés : hitbox, orientation manuelle et déplacement des champs.
  const HITBOX_KEY='b88-admin-hitbox-settings';
  const hitboxDefaults={width:140,height:145,offsetX:0,offsetY:0};
  let hitbox={...hitboxDefaults};
  try{hitbox={...hitboxDefaults,...JSON.parse(localStorage.getItem(HITBOX_KEY)||'{}')};}catch(e){}
  const hitboxPreview=el('div');
  let hitboxPreviewEnabled=false;
  Object.assign(hitboxPreview.style,{position:'fixed',display:'none',pointerEvents:'none',zIndex:10000,border:'2px dashed #ff3333',background:'rgba(255,50,50,.12)'});
  document.body.append(hitboxPreview);
  let hitboxRaf=0;
  function updateHitboxPreview(){
    if(hitboxRaf)cancelAnimationFrame(hitboxRaf);
    const tick=()=>{if(!hitboxPreviewEnabled){hitboxPreview.style.display='none';hitboxRaf=0;return;}const bounds=window.characterGetScreenBounds?.();if(bounds){const cx=(bounds.left+bounds.right)/2,cy=(bounds.top+bounds.bottom)/2;Object.assign(hitboxPreview.style,{display:'block',width:hitbox.width+'px',height:hitbox.height+'px',left:(cx+hitbox.offsetX-hitbox.width/2)+'px',top:(cy+hitbox.offsetY-hitbox.height/2)+'px'});}else hitboxPreview.style.display='none';hitboxRaf=requestAnimationFrame(tick);};tick();
  }
  const rotationSliders={};
  const fieldMoveState={enabled:false};
  const dialogueSelectors=['.b88-dialogue-bubble','.b88-dialogue-form'];
  function dialogueElements(){return dialogueSelectors.map(sel=>document.querySelector(sel)).filter(Boolean);}
  function readFieldOffsets(){const read=sel=>{const node=document.querySelector(sel);return{x:Number(node?.dataset.dragX||0),y:Number(node?.dataset.dragY||0)};};return{bubble:read(dialogueSelectors[0]),form:read(dialogueSelectors[1])};}
  function attachDialogueDrag(node){if(node.dataset.adminDragBound==='true')return;node.dataset.adminDragBound='true';node.dataset.dragX=node.dataset.dragX||'0';node.dataset.dragY=node.dataset.dragY||'0';node.addEventListener('pointerdown',event=>{if(!fieldMoveState.enabled||event.button!==0)return;event.preventDefault();event.stopPropagation();const sx=event.clientX,sy=event.clientY,ix=Number(node.dataset.dragX),iy=Number(node.dataset.dragY);const move=e=>{const x=ix+e.clientX-sx,y=iy+e.clientY-sy;node.dataset.dragX=String(x);node.dataset.dragY=String(y);node.style.translate=`${x}px ${y}px`;};const stop=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',stop);document.removeEventListener('pointercancel',stop);};document.addEventListener('pointermove',move);document.addEventListener('pointerup',stop);document.addEventListener('pointercancel',stop);});}
  const dialogueObserver=new MutationObserver(()=>dialogueElements().forEach(node=>{attachDialogueDrag(node);if(fieldMoveState.enabled){node.style.cursor='move';node.style.outline='2px dashed #e58e26';}}));
  dialogueObserver.observe(document.body,{childList:true,subtree:true});
  dialogueElements().forEach(attachDialogueDrag);
  function renderTools(){
    view.replaceChildren();view.append(heading('Outils de configuration du personnage'),help('Ces réglages restent disponibles indépendamment de la création des scénarios.'));
    view.append(heading('Hitbox — zone de clic'));
    const hitFields={};
    [['width','Largeur (px)',20,1000],['height','Hauteur (px)',20,1000],['offsetX','Décalage horizontal',-500,500],['offsetY','Décalage vertical',-500,500]].forEach(([key,label,min,max])=>{const i=input('number',String(hitbox[key]));i.min=min;i.max=max;i.addEventListener('input',()=>{const n=num(i.value);if(n!==null)hitbox[key]=Math.max(min,Math.min(max,n));});hitFields[key]=i;view.append(field(label,i));});
    view.append(button(hitboxPreviewEnabled?'Masquer l’aperçu de hitbox':'Afficher l’aperçu de hitbox',()=>{hitboxPreviewEnabled=!hitboxPreviewEnabled;updateHitboxPreview();renderTools();}));
    view.append(button('Enregistrer les réglages de hitbox',()=>{Object.keys(hitFields).forEach(k=>hitbox[k]=num(hitFields[k].value)??hitboxDefaults[k]);try{localStorage.setItem(HITBOX_KEY,JSON.stringify(hitbox));status.textContent='Réglages de hitbox enregistrés dans ce navigateur.';}catch(e){status.textContent='Impossible d’enregistrer la hitbox.';}},'primary'));
    view.append(heading('Orientation manuelle'));
    window.characterRotate?.(currentRotation.x,currentRotation.y,currentRotation.z);
    ['x','y','z'].forEach(axis=>{const wrap=el('div');const label=el('label',axis.toUpperCase()+' — 0°');const slider=input('range','0');slider.min='0';slider.max='360';slider.value=currentRotation[axis]||0;slider.addEventListener('input',()=>{currentRotation[axis]=Number(slider.value);label.textContent=axis.toUpperCase()+' — '+slider.value+'°';window.characterRotate?.(currentRotation.x,currentRotation.y,currentRotation.z);});rotationSliders[axis]=slider;wrap.append(label,slider);view.append(wrap);});
    view.append(button('Réinitialiser orientation',()=>{currentRotation={x:0,y:0,z:0};Object.values(rotationSliders).forEach(sl=>sl.value=0);window.characterRotate?.(0,0,0);}));
    view.append(heading('Déplacement des champs de dialogue'));
    view.append(help('Active le mode puis fais glisser la bulle ou le champ de saisie. Les décalages sont mémorisés dans chaque étape ajoutée ensuite.'));
    view.append(button(fieldMoveState.enabled?'Désactiver le déplacement':'Activer le déplacement des champs',()=>{fieldMoveState.enabled=!fieldMoveState.enabled;dialogueElements().forEach(node=>{attachDialogueDrag(node);node.style.cursor=fieldMoveState.enabled?'move':'';node.style.outline=fieldMoveState.enabled?'2px dashed #e58e26':'';});renderTools();}));
    view.append(button('Réinitialiser les positions des champs',()=>{dialogueElements().forEach(node=>{node.dataset.dragX='0';node.dataset.dragY='0';node.style.translate='0px 0px';});status.textContent='Positions des champs réinitialisées.';}));
  }

  function showView(which){
    overviewTab.classList.toggle('primary',which==='overview');editorTab.classList.toggle('primary',which==='editor');checkTab.classList.toggle('primary',which==='check');toolsTab.classList.toggle('primary',which==='tools');
    if(which==='overview')renderOverview();if(which==='editor')renderEditor();if(which==='check')renderCheck();if(which==='tools')renderTools();
  }
  document.body.appendChild(panel);
  showView('overview');
})();

