const fs=require('fs'),vm=require('vm');
let harness=fs.readFileSync('tests/test-controls.cjs','utf8').split('\nfunction key(')[0];
harness=harness.replace('window.__t={state,settings,keys,','window.__t={tick,newGame,buildMenus,state,settings,keys,');
harness+=`
t.settings.sound=false;t.settings.transitions=false;t.settings.length='short';t.startActivity('recycler',true);t.state.score=5000;t.snapshot();assert(t.saved);
const file=ids.get('menubar').children.find(el=>el.children[0].attrs['aria-label']==='File');
const newGame=file.children[1].children.find(el=>el.attrs['aria-label']==='New Game');assert(newGame);newGame.onclick();
assert.equal(t.state.scene,'zapper');assert(t.state.mission);assert.equal(t.state.score,0);assert.equal(t.activity.collected,0);assert.equal(t.saved.scene,'zapper');assert.equal(t.saved.score,0);
console.log('File > New Game starts a fresh mission and replaces the previous saved run.');
for(const transitions of [false,true]){t.settings.transitions=transitions;t.settings.length='long';t.newGame();assert.equal(t.state.length,'long');assert.equal(t.state.scene,transitions?'movie':'zapper');assert.equal(t.state.score,0);if(transitions)assert.equal(t.saved,null);}
t.settings.transitions=false;
t.startActivity('blaster',false);t.tick(clock=1000);const a=t.activity;const before=a.player.x;t.tick(clock+=60);assert.equal(a.player.x,before,'60ms does not advance the new 70ms Math Blaster clock');t.tick(clock+=10);assert.notEqual(a.player.x,before,'70ms advances exactly one original physics tick');
const expected=a.player.x;windowEvents.get('blur')();t.tick(clock+=200);assert.equal(a.player.x,expected);windowEvents.get('focus')();t.tick(clock+=69);assert.equal(a.player.x,expected);t.tick(clock+=1);assert.notEqual(a.player.x,expected);
console.log('Math Blaster cadence is 70ms per unchanged physics tick; focus loss cannot accelerate it.');
`;
vm.runInNewContext(harness,{require,console,process});
