/* End-to-end candidate workflow for the Manager Interview Sandbox.
   Serves the repo from a GitHub-Pages-like subpath (/manager-sandbox/) and
   drives the app in Chromium through Playwright.

     node tests/e2e.js            # run
     SHOTS=1 node tests/e2e.js    # also write screenshots to tests/output/
*/
const http=require("http"), fs=require("fs"), path=require("path");
const {chromium}=require("playwright");

const ROOT=path.resolve(__dirname,".."), OUT=path.join(__dirname,"output");
const BASE="/manager-sandbox/";
const TYPES={".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".svg":"image/svg+xml",".png":"image/png"};
fs.mkdirSync(OUT,{recursive:true});

let failures=0, passes=0;
function check(cond,msg){ if(cond){ passes++; console.log("  ✓",msg); } else { failures++; console.log("  ✗",msg); } }
const step=t=>console.log("\n"+t);

function serve(){
  return new Promise(res=>{
    const srv=http.createServer((req,resp)=>{
      let u=decodeURIComponent(req.url.split("?")[0]);
      if(!u.startsWith(BASE)){ resp.writeHead(404); return resp.end(); }
      let f=path.join(ROOT,u.slice(BASE.length)); if(f.endsWith(path.sep)||u===BASE) f=path.join(f,"index.html");
      if(!f.startsWith(ROOT)||!fs.existsSync(f)){ resp.writeHead(404); return resp.end(); }
      resp.writeHead(200,{"content-type":TYPES[path.extname(f)]||"application/octet-stream"}); fs.createReadStream(f).pipe(resp);
    }).listen(0,()=>res(srv));
  });
}
/* explicit mouse drag — steadier than dragTo while smooth scrolling settles */
async function mouseDrag(page,src,dst){
  await page.waitForTimeout(400);
  await src.scrollIntoViewIfNeeded(); const a=await src.boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2); await page.mouse.down();
  const b=await dst.boundingBox(); await page.mouse.move(b.x+40,b.y+10,{steps:8}); await page.mouse.up();
}
const pdfPages=buf=>(buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)||[]).length;

(async()=>{
  const srv=await serve(), URL=`http://localhost:${srv.address().port}${BASE}`;
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
  const page=await ctx.newPage();
  const errors=[], external=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{ if(m.type()==="error") errors.push(m.text()); });
  page.on("request",r=>{ if(!r.url().startsWith(`http://localhost:${srv.address().port}`)&&!r.url().startsWith("data:")&&!r.url().startsWith("blob:")) external.push(r.url()); });
  await page.addInitScript(()=>{ window.__prints=0; window.print=()=>{ window.__prints++; }; });
  const shot=async n=>{ if(process.env.SHOTS) await page.screenshot({path:path.join(OUT,n+".png"),fullPage:false}); };
  const W=()=>page.evaluate(()=>JSON.parse(JSON.stringify(window.MIS.W)));

  step("1. Open the app — intro, blank workspace");
  await page.goto(URL);
  check(await page.isVisible("#intro"),"intro is shown on first open");
  let w=await W();
  check(w.categories.length===0&&w.activities.length===0&&Object.keys(w.schedules).length===0,"workspace starts blank (no preloaded categories, activities or schedules)");
  await page.fill("#inName","Jordan Sample");
  await page.fill("#inLabel","Double-A Manager Interview");
  await page.selectOption("#inMonth","5"); await page.fill("#inYear","2027");
  await shot("01-intro");
  await page.click("#inStart");
  check(await page.isHidden("#intro"),"intro closes on Start planning");
  check(await page.isVisible("#viewPlayers.on"),"a new candidate starts on Player Evaluations (step 1)");
  check(await page.locator("nav.seg [role=tab]").count()===4&&(await page.textContent("nav.seg")).includes("Player Evaluations"),"navigation: Player Evaluations | Monthly Planner | Daily Schedules (+ Review & Export)");
  await page.click('nav.seg [data-view="month"]');
  check((await page.textContent("#calTitle")).includes("June 2027"),"planning month set to June 2027");
  check((await page.textContent("#barDesc")).includes("Jordan Sample"),"candidate name shows in the header");

  step("2. Categories");
  for(const n of ["Team defense","Hitting","Pitching & catching","Staff"]){ await page.fill("#catNew",n); await page.press("#catNew","Enter"); }
  w=await W();
  check(w.categories.length===4,"four candidate-made categories");
  check(new Set(w.categories.map(c=>c.color)).size===4,"each new category gets a distinct colour");
  await page.click('[data-catrow] >> nth=0 >> .cat-n');
  check(await page.evaluate(()=>window.MIS.UI.activeCat)===w.categories[0].id,"clicking a category selects it as the brush");
  await page.click('[data-catmenu] >> nth=3'); await page.click('#menu button:has-text("Delete category")');
  check((await W()).categories.length===3,"category deleted from its menu");
  await page.keyboard.press("Control+z");
  check((await W()).categories.length===4,"Ctrl+Z restores the deleted category");
  await page.click(`[data-catcolor="${w.categories[1].id}"]`);
  await page.click('#menu [data-swpick="#7A4BC4"]');
  check((await W()).categories[1].color==="#7A4BC4","category colour changed from the palette");
  await page.fill(`[data-catname="${w.categories[1].id}"]`,"Offense");
  await page.press(`[data-catname="${w.categories[1].id}"]`,"Enter");
  check((await W()).categories[1].name==="Offense","category renamed inline");

  step("3. Quick-add activities on the calendar");
  await page.hover('[data-dropday="2027-06-08"]');
  await page.click('[data-qa="2027-06-08"]');
  await page.fill('.qa','Bunt defense'); await page.press('.qa','Enter');
  await page.fill('.qa','Cuts & relays'); await page.press('.qa','Enter');
  await page.keyboard.press("Escape");
  w=await W();
  check(w.activities.filter(a=>a.date==="2027-06-08").length===2,"two activities quick-added on Jun 8");
  check(w.activities.every(a=>a.catId===w.categories[0].id),"quick-add uses the selected category");
  await page.click('[data-catrow] >> nth=0 >> .cat-n');  // clear brush
  await page.hover('[data-dropday="2027-06-10"]'); await page.click('[data-qa="2027-06-10"]');
  await page.fill('.qa','Early work — hitters'); await page.press('.qa','Enter'); await page.keyboard.press("Escape");
  check((await W()).activities.some(a=>a.date==="2027-06-10"&&!a.catId),"quick-add with no category selected leaves it uncategorized");
  await page.fill('[data-weekfocus="2027-06-07"]','Defensive communication');
  await page.press('[data-weekfocus="2027-06-07"]','Tab');
  check((await W()).weeks["2027-06-07"].focus==="Defensive communication","weekly focus saved");
  await shot("02-month");

  step("4. Edit an activity: time, notes, category, repeat, duplicate");
  await page.click('.ac:has-text("Early work")');
  check(await page.isVisible("#pop.on"),"activity editor opens on click");
  await page.fill('#pop [data-ap="time"]','2:30');
  await page.fill('#pop [data-ap="notes"]','Two-strike approach; staff: hitting coach');
  await page.click(`#pop [data-apcat="${w.categories[1].id}"]`);
  await page.click('#pop [data-aprepeat]');
  await page.click('#pop [data-repgo]');
  w=await W();
  const ew=w.activities.filter(a=>a.title.startsWith("Early work"));
  check(ew.length===3&&ew.every(a=>a.seriesId&&a.seriesId===ew[0].seriesId),"weekly repeat through month end: Jun 10, 17, 24 in one series");
  check(ew.every(a=>a.time==="2:30"&&a.catId===w.categories[1].id),"repeats carry time and category");
  await page.check('#pop [data-apall]');
  await page.fill('#pop [data-ap="title"]','Early work (hitters)');
  check((await W()).activities.filter(a=>a.title==="Early work (hitters)").length===3,"'apply to series' renames all three");
  await page.click('#pop [data-apdup]');
  check((await W()).activities.filter(a=>a.title==="Early work (hitters)").length===4,"duplicate adds a copy");
  await page.click('#pop [data-apdel]');
  check((await W()).activities.filter(a=>a.title==="Early work (hitters)").length===3,"delete removes it");
  await page.click('.ac:has-text("Early work") >> nth=0');
  await page.click('#pop [data-apnewcat]'); await page.fill('#pop [data-apnewcatname]','Player development'); await page.press('#pop [data-apnewcatname]','Enter');
  w=await W();
  check(w.categories.length===5&&w.activities.find(a=>a.date==="2027-06-10").catId===w.categories[4].id,"new category created from the editor and applied");
  await page.click('#pop [data-popclose] >> nth=-1');
  check(!(await page.isVisible("#pop.on")),"editor closes with Done");

  step("5. Drag to move, Alt-drag to copy");
  await page.locator('.ac:has-text("Cuts & relays")').dragTo(page.locator('[data-dropday="2027-06-09"]'),{targetPosition:{x:70,y:90}});
  w=await W();
  check(w.activities.find(a=>a.title==="Cuts & relays").date==="2027-06-09","drag moved Cuts & relays to Jun 9");
  await page.keyboard.down("Alt");
  await page.locator('.ac:has-text("Bunt defense")').dragTo(page.locator('[data-dropday="2027-06-15"]'),{targetPosition:{x:70,y:90}});
  await page.keyboard.up("Alt");
  w=await W();
  const bd=w.activities.filter(a=>a.title==="Bunt defense").map(a=>a.date).sort();
  check(bd.join()==="2027-06-08,2027-06-15","Alt-drag copied Bunt defense to Jun 15 (original kept)");

  step("6. Day drawer → build a daily schedule");
  await page.click('[data-dropday="2027-06-09"] .dc-n');
  check(await page.isVisible("#drawer.on"),"day drawer opens");
  await page.fill('[data-dayf="tag"]','Home vs. Opponent');
  await page.fill('[data-dayf="notes"]','Getaway day tomorrow — keep it crisp.');
  await page.fill('#drAdd','PFP'); await page.press('#drAdd','Enter');
  await page.fill('#drAdd','Pregame meeting'); await page.press('#drAdd','Enter');
  w=await W();
  check(w.days["2027-06-09"].tag==="Home vs. Opponent"&&w.activities.filter(a=>a.date==="2027-06-09").length===3,"label, notes and two activities added from the drawer");
  await page.click('[data-actmove][data-dir="1"] >> nth=0');
  check((await W()).activities.filter(a=>a.date==="2027-06-09").sort((a,b)=>a.order-b.order)[0].title==="PFP","reorder within the day with ↓");
  await page.click('[data-dritemcat] >> nth=0'); await page.click('#menu button:has-text("Pitching & catching")');
  check((await W()).activities.find(a=>a.title==="PFP").catId===w.categories[2].id,"category set from the drawer");
  await shot("03-drawer");
  await page.click('[data-drsched]');
  check(await page.isVisible("#viewDaily.on"),"Build daily schedule opens the daily builder");
  w=await W();
  check(!!w.schedules["2027-06-09"]&&w.schedules["2027-06-09"].context==="Home vs. Opponent","schedule created with day label as context");

  step("7. Build the first daily schedule");
  await page.fill('[data-sf="title"]','Pregame Practice');
  await page.fill('[data-sf="location"]','Home ballpark');
  await page.fill('[data-sf="notes"]','Priority: clean fundamentals before the series.');
  const sec0=(await W()).schedules["2027-06-09"].sections[0].id;
  await page.fill(`[data-secf="name"][data-sec="${sec0}"]`,'Full team');
  const r0=`[data-sec="${sec0}"][data-rf="time"] >> nth=0`;
  await page.fill(r0,'1230-1250'); await page.press(r0,'Tab');
  await page.keyboard.type('Stretch & throw'); await page.keyboard.press('Tab');
  await page.keyboard.type('Field'); await page.keyboard.press('Tab');
  await page.keyboard.type('S&C coach'); await page.keyboard.press('Enter');
  w=await W(); let S=w.schedules["2027-06-09"];
  check(S.sections[0].rows[0].time==="12:30"&&S.sections[0].rows[0].timeEnd==="12:50","\"1230-1250\" normalizes to 12:30 – 12:50");
  check(S.sections[0].rows.length===2&&S.sections[0].rows[1].time==="12:50","Enter adds a row that starts when the last one ended");
  check(await page.evaluate(()=>{ const a=document.activeElement; return a.dataset.rf==="time"&&a.value==="12:50"&&a.selectionStart===0&&a.selectionEnd===5; }),"the pre-filled start is selected so typing replaces it");
  await page.keyboard.type('12:50-1:20');
  await page.keyboard.press('Tab'); await page.keyboard.type('Cuts & relays');
  await page.keyboard.press('Enter');
  await page.keyboard.type('1:20-1:40'); await page.keyboard.press('Tab'); await page.keyboard.type('PFP');
  await page.click('body',{position:{x:5,y:300}});
  w=await W(); S=w.schedules["2027-06-09"];
  check(S.sections[0].rows.length===3&&S.sections[0].rows[1].timeEnd==="1:20","three timed rows");
  // planned chips
  check(await page.locator('.planned .pchip.done').count()===2,"planned chips show 2 of 3 already on the schedule (matched by name)");
  await page.click('.planned .pchip:has-text("Pregame meeting")');
  w=await W(); S=w.schedules["2027-06-09"];
  check(S.sections[0].rows.some(r=>r.activity==="Pregame meeting"&&r.src),"clicking a planned chip adds it as a row");
  // row category
  await page.click(`[data-rowcat] >> nth=0`); await page.click('#menu button:has-text("Team defense")');
  check((await W()).schedules["2027-06-09"].sections[0].rows[0].catId===w.categories[0].id,"row category set from its dot");
  // time shift pill
  await page.fill(r0,'12:40-1:00'); await page.press(r0,'Tab');
  check(await page.isVisible("#pill.on"),"changing a start time offers to push the rows below");
  await page.click('#pill [data-shift="section"]');
  S=(await W()).schedules["2027-06-09"];
  check(S.sections[0].rows[1].time==="1:00"&&S.sections[0].rows[1].timeEnd==="1:30","rows below pushed +10 min");
  // detail line + duplicate + delete via keyboard
  const act1=`[data-sec="${sec0}"][data-rf="activity"] >> nth=1`;
  await page.click(act1); await page.keyboard.press('Alt+d');
  await page.keyboard.type('IF/OF communication; catchers with pitchers');
  await page.click(act1); await page.keyboard.press('Control+d');
  check((await W()).schedules["2027-06-09"].sections[0].rows.length===5,"Ctrl+D duplicates a row");
  await page.keyboard.press('Control+Backspace');
  check((await W()).schedules["2027-06-09"].sections[0].rows.length===4,"Ctrl+Backspace deletes a row");
  check(!!(await W()).schedules["2027-06-09"].sections[0].rows[1].detail,"Alt+D adds a details line");
  // side-by-side sections
  await page.click('[data-addsec="0.5"]');
  await page.keyboard.type('Pitchers');
  await page.click('.secgap');
  await page.keyboard.type('Position players');
  S=(await W()).schedules["2027-06-09"];
  check(S.sections.length===3&&S.sections[1].width===.5&&S.sections[2].width===.5,"two half-width sections share a row");
  const pit=S.sections[1].id;
  await page.fill(`[data-sec="${pit}"][data-rf="time"]`,'3:00-3:20'); await page.press(`[data-sec="${pit}"][data-rf="time"]`,'Tab');
  await page.keyboard.type('Bullpens'); await page.keyboard.press('Tab'); await page.keyboard.type('Bullpen');
  await page.fill(`[data-secf="who"][data-sec="${pit}"]`,'Starters + relievers on schedule');
  await page.click(`[data-seccolor="${pit}"]`); await page.click('#menu button:has-text("Orange")');
  check((await W()).schedules["2027-06-09"].sections[1].color==="#EB6E1F","section header colour changed");
  await page.click(`[data-secwidth="${S.sections[2].id}"]`); await page.click('#menu button:has-text("One-third width")');
  check(Math.abs((await W()).schedules["2027-06-09"].sections[2].width-1/3)<.01,"section width changed to one-third");
  await page.click(`[data-secmenu="${pit}"]`); await page.click('#menu button:has-text("Show Staff column")');
  check((await W()).schedules["2027-06-09"].sections[1].hideStaff===true,"Staff column hidden for a section");
  // suggestions from what was typed earlier
  await page.click(`[data-addrow="${pit}"]`); await page.keyboard.press('Tab');
  await page.keyboard.type('Bu');
  check(await page.isVisible("#combo.on")&&(await page.textContent("#combo")).includes("Bunt defense"),"activity suggestions come from the candidate's own entries");
  await page.keyboard.press('Escape');
  // rotation grid
  await page.click('#addRotation');
  await page.fill('#rgName','Defensive stations');
  await page.fill('#rgGroups','Infielders, Outfielders, Catchers');
  await page.fill('#rgStations','Double plays, Fly balls, Blocking');
  await page.fill('#rgStart','2:00'); await page.fill('#rgLen','12'); await page.fill('#rgGap','3');
  await page.click('#rgGo');
  S=(await W()).schedules["2027-06-09"];
  const g=S.sections.find(s=>s.kind==="grid");
  check(g&&g.columns.length===3&&g.rows.length===3,"rotation grid: 3 stations × 3 rotations");
  check(g.rows[1].time==="2:15"&&g.rows[1].timeEnd==="2:27"&&g.rows[1].cells[g.columns[1].id]==="Infielders","rotation timing and assignment follow the candidate's inputs");
  await page.click(`[data-coladd="${g.id}"]`);
  check((await W()).schedules["2027-06-09"].sections.find(s=>s.kind==="grid").columns.length===4,"add a grid column");
  await page.click('[data-secfold] >> nth=0');
  check((await W()).schedules["2027-06-09"].sections[0].collapsed===true,"collapse a section");
  await page.click('[data-secfold] >> nth=0');
  check((await W()).schedules["2027-06-09"].sections[0].collapsed===false,"expand it again");
  // drag a row between sections
  await page.evaluate(()=>document.getElementById("toast").classList.remove("on"));
  const before=(await W()).schedules["2027-06-09"].sections[1].rows.length;
  await mouseDrag(page,page.locator(`[data-rowsof="${sec0}"] [data-rowgrip] >> nth=3`),page.locator(`[data-rowsof="${pit}"] .row >> nth=0`));
  const after=(await W()).schedules["2027-06-09"].sections[1].rows.length;
  check(after===before+1,"drag a row from one section into another");
  await page.keyboard.press("Control+z");
  check((await W()).schedules["2027-06-09"].sections[1].rows.length===before,"undo the row drag");
  await shot("04-daily");

  step("8. Second daily schedule — from the New schedule picker, copying a layout");
  await page.click('#dNew');
  await page.click('[data-pickdate="2027-06-15"]');
  check(!!(await W()).schedules["2027-06-15"],"second schedule created for Jun 15");
  await page.click('#schCopyFrom'); await page.click('#clGo');
  S=(await W()).schedules["2027-06-15"];
  check(S.sections.length===4&&S.sections[0].name==="Full team"&&S.sections[0].rows.length===1&&!S.sections[0].rows[0].activity,"copy layout (sections only) from the first day");
  await page.fill('[data-sf="title"]','Off-day Workout');
  const s15=S.sections[0].id;
  await page.fill(`[data-sec="${s15}"][data-rf="time"]`,'10-11'); await page.press(`[data-sec="${s15}"][data-rf="time"]`,'Tab');
  await page.keyboard.type('Bunt defense');
  await page.click('[data-dtab="2027-06-09"]');
  check((await page.inputValue('[data-sf="title"]'))==="Pregame Practice","tabs switch between daily schedules");
  check((await page.textContent("#navN"))==="2","nav shows 2 daily schedules");
  await page.fill('#fDate','2027-06-11'); await page.dispatchEvent('#fDate','change');
  w=await W();
  check(!!w.schedules["2027-06-11"]&&!w.schedules["2027-06-09"],"changing the date moves the schedule");
  await page.keyboard.press("Control+z");
  check(!!(await W()).schedules["2027-06-09"],"undo the date move");

  step("9. Monthly ↔ daily navigation, week view");
  await page.click('nav.seg [data-view="month"]');
  check(await page.locator('[data-schedopen="2027-06-09"]').count()===1,"month cell shows the daily-schedule badge");
  await page.click('[data-schedopen="2027-06-09"]');
  check(await page.isVisible("#viewDaily.on"),"badge opens the daily schedule");
  await page.click('[data-tomonth] >> nth=0');
  check(await page.isVisible("#viewMonth.on")&&await page.isVisible("#drawer.on"),"'Monthly plan for this day' returns to the month with the day open");
  await page.click('[data-drclose]');
  await page.click('[data-mmode="week"]');
  check(await page.locator('.wv-col').count()===7,"week view shows 7 columns");
  const wk1=await page.textContent("#calTitle"); await page.click('#calNext');
  check((await page.textContent("#calTitle"))!==wk1,"next-week arrow moves the week");
  await page.locator('.wc >> nth=0').dragTo(page.locator('.wv-col >> nth=3'));
  await page.keyboard.press("Control+z");
  await page.fill('[data-weeknotes]','Series vs. a strong running team.');
  await page.press('[data-weeknotes]','Tab');
  await shot("05-week");
  await page.click('[data-mmode="month"]');
  await page.selectOption('#weekStartSel','0');
  check((await W()).plan.weekStart===0&&(await W()).weeks["2027-06-06"].focus==="Defensive communication","switching weeks to start Sunday keeps weekly focus attached");
  await page.selectOption('#weekStartSel','1');
  await page.click('#calTitle'); await page.click('#menu [data-mp="6"]');
  check((await page.textContent("#calTitle")).includes("July 2027"),"month picker changes the month");
  await page.click('#calPrev');
  check((await page.textContent("#calTitle")).includes("June 2027"),"previous-month arrow");
  await page.fill('#sidePri','Daily fundamentals; develop catchers as leaders; protect arms.');
  await page.press('#sidePri','Tab');

  step("10. Player evaluations, prescriptions and links to the schedule");
  await page.click('nav.seg [data-view="players"]');
  check(await page.locator("[data-case-open]").count()===4,"four player cases");
  const names=[];
  for(const id of ["inf","of","c","br"]){
    await page.click(`.ev-cases [data-case-open="${id}"]`);
    const t=await page.textContent(".ev-prof");
    names.push((await page.textContent(".ev-prof h2")).trim());
    check(/Background/.test(t)&&/Performance/.test(t)&&/Scouting/.test(t)&&/Development context/.test(t),`${id}: profile shows background, performance, scouting and context`);
    check(await page.locator(`textarea[data-case="${id}"]`).count()===7,`${id}: seven freeform fields (3 evaluation + 4 prescription)`);
  }
  check(new Set(names).size===4,`distinct fictional players: ${names.join(", ")}`);
  await page.click('.ev-cases [data-case-open="c"]');
  const answers={strengths:"Game calling and receiving; staff trust.",opportunities:"Blocking to glove side; late-game throwing.",observations:"Workload in June may explain late pop times.",
    priority:"Blocking footwork to the glove side.",intervention:"Short daily block-and-recover sequences with the catching coordinator.",implementation:"10 minutes pregame, 4 days a week; no extra work after day games.",measurement:"PB/WP per 100 pitches and video of glove-side blocks, reviewed weekly."};
  for(const [k,v] of Object.entries(answers)) await page.fill(`textarea[data-case="c"][data-evf="${k}"]`,v);
  await page.press('textarea[data-case="c"][data-evf="measurement"]','Tab');
  await page.click('.ev-cases [data-case-open="inf"]');
  await page.fill('textarea[data-case="inf"][data-evf="strengths"]','Hands, first step, works hard.');
  w=await W();
  check(JSON.stringify(w.evals.c)===JSON.stringify(answers),"catcher evaluation and prescription saved to the workspace");
  check((await page.textContent('[data-case-open="c"]')).includes("Started"),"case tab shows the evaluation has been started");
  await shot("08-players");
  // link a monthly activity
  await page.click('nav.seg [data-view="month"]');
  await page.click('[data-dropday="2027-06-08"] .ac:has-text("Bunt defense")');
  await page.click('#pop [data-applayer="inf"]');
  await page.click('#pop [data-popclose] >> nth=-1');
  w=await W();
  check(w.activities.find(a=>a.date==="2027-06-08"&&a.title==="Bunt defense").playerId==="inf","activity linked to the infielder from the activity editor");
  check((await page.textContent('[data-dropday="2027-06-08"] .ac:has-text("Bunt defense")')).includes("RI"),"calendar chip shows the linked player's initials");
  await page.click('[data-dropday="2027-06-15"] .ac:has-text("Bunt defense")');
  await page.click('#pop [data-applayer="inf"]'); await page.keyboard.press("Escape");
  // link a daily row, and carry a link through a planned chip
  await page.click('[data-schedopen="2027-06-09"]');
  await page.click('[data-rowmenu] >> nth=0'); await page.click('#menu button:has-text("Link to a player")');
  await page.click('#menu button:has-text("Sam Kowalczyk")');
  w=await W();
  check(w.schedules["2027-06-09"].sections[0].rows[0].playerId==="c","daily-schedule row linked to the catcher from its ⋯ menu");
  check(await page.locator('.rowpl:has-text("Kowalczyk")').count()===1,"row shows a player badge");
  await page.click('[data-dtab="2027-06-15"]');
  await page.click('.planned .pchip:has-text("Bunt defense")');
  w=await W();
  check(w.schedules["2027-06-15"].sections.some(s=>s.rows.some(r=>r.activity==="Bunt defense"&&r.playerId==="inf")),"a planned activity added to the day keeps its player link");
  await page.click('.rowpl >> nth=0'); await page.click('#menu button:has-text("No player")');
  check(!(await W()).schedules["2027-06-15"].sections.some(s=>s.rows.some(r=>r.playerId)),"clicking the badge lets the link be removed");
  await page.keyboard.press("Control+z");
  // profile lists scheduled work
  await page.click('nav.seg [data-view="players"]');
  await page.click('.ev-cases [data-case-open="inf"]');
  const links=await page.locator(".ev-link").allTextContents();
  check(links.length===3&&links.filter(x=>x.includes("Monthly plan")).length===2&&links.filter(x=>x.includes("Daily schedule")).length===1,"infielder profile lists 2 monthly activities and 1 daily row");
  await page.click('.ev-link:has-text("Daily schedule")');
  check(await page.isVisible("#viewDaily.on"),"a linked item opens its schedule");
  await page.click('nav.seg [data-view="players"]');
  await page.click('.ev-link >> nth=0');
  check(await page.isVisible("#viewMonth.on")&&await page.isVisible("#drawer.on"),"a linked monthly item opens that day in the planner");
  await page.click('[data-drclose]');

  step("10b. Plan overview");
  await page.click('nav.seg [data-view="overview"]');
  const ov=await page.textContent("#overview");
  check(ov.includes("Jordan Sample")&&ov.includes("Pregame Practice")&&ov.includes("Off-day Workout"),"overview lists candidate and both schedules");
  check(ov.includes("Player evaluations")&&ov.includes("Sam Kowalczyk")&&ov.includes("Blocking footwork"),"overview lists the four players with their primary priority");
  check(ov.includes("Team defense")&&/\d+m|\dh/.test(ov),"overview shows categories with monthly entries and scheduled time");
  check((await page.inputValue('#overview textarea'))==="Daily fundamentals; develop catchers as leaders; protect arms.","priorities shared between planner and overview");
  await shot("06-overview");

  step("11. Save and reload");
  await page.waitForTimeout(500);
  const beforeReload=await W();
  await page.reload();
  check(await page.isHidden("#intro"),"returning candidate goes straight back in");
  const afterReload=await W();
  check(JSON.stringify(afterReload)===JSON.stringify(beforeReload),"all activities and schedules survive a reload");
  check(await page.isVisible("#viewOverview.on"),"last view is remembered");

  step("12. Print / PDF");
  const pdfs={};
  for(const [kind,date] of [["month"],["daily","2027-06-09"],["evals"],["eval","c"],["package"]]){
    await page.evaluate(([k,d])=>window.MIS.buildPrint(k,d),[kind,date]);
    await page.emulateMedia({media:"print"});
    const landscape=kind==="month";
    const buf=await page.pdf({format:"Letter",landscape,preferCSSPageSize:true,printBackground:true});
    fs.writeFileSync(path.join(OUT,`print-${kind}.pdf`),buf);
    pdfs[kind]=pdfPages(buf);
    await page.emulateMedia({media:"screen"});
  }
  check(pdfs.month>=2,`monthly plan prints (calendar + details): ${pdfs.month} pages`);
  check(pdfs.daily===1,`daily schedule fits on one page: ${pdfs.daily} page`);
  check(pdfs.evals>=4,`player evaluations print one or more pages per player: ${pdfs.evals} pages`);
  check(pdfs.eval>=1&&pdfs.eval<=2,`a single player evaluation prints on its own: ${pdfs.eval} page(s)`);
  check(pdfs.package>=5+pdfs.evals,`review package = cover + evaluations + calendar + details + 2 daily: ${pdfs.package} pages`);
  const etxt=await page.evaluate(()=>window.MIS.buildPrint("evals")&&document.getElementById("printRoot").innerText);
  check(etxt.includes("Blocking footwork to the glove side.")&&etxt.includes("Left blank")&&etxt.includes("Bunt defense"),"printed evaluations carry the candidate's text, blanks and linked activities");
  const ptxt=await page.evaluate(()=>window.MIS.buildPrint("package")&&document.getElementById("printRoot").innerText);
  check(ptxt.includes("Pregame Practice")&&ptxt.includes("Defensive communication")&&ptxt.includes("Two-strike approach"),"printed package carries titles, weekly focus and notes");
  await page.click('[data-print="month"]'); await page.waitForTimeout(150);
  await page.click('[data-print="daily"] >> nth=0'); await page.waitForTimeout(150);
  await page.click('[data-print="package"]'); await page.waitForTimeout(150);
  check(await page.evaluate(()=>window.__prints)===3,"print buttons open the print dialog");

  step("13. Export → new exercise → import");
  const [dl]=await Promise.all([page.waitForEvent("download"),page.click("#ovExport")]);
  const file=path.join(OUT,dl.suggestedFilename()); await dl.saveAs(file);
  check(/manager-sandbox_jordan-sample_2027-06\.json$/.test(file),"export filename includes candidate and month");
  const exported=JSON.parse(fs.readFileSync(file,"utf8"));
  check(exported.app==="manager-interview-sandbox"&&exported.activities.length===beforeReload.activities.length&&Object.keys(exported.schedules).length===2,"export contains the whole plan");
  check(exported.schema===2&&JSON.stringify(exported.evals.c)===JSON.stringify(answers)&&exported.activities.some(a=>a.playerId==="inf"),"export contains evaluations, prescriptions and player links");
  await page.click("#btnFile"); await page.click('#menu button:has-text("Start a new exercise")');
  await page.click("#cmOk");
  check(await page.isVisible("#intro"),"new exercise returns to the intro");
  w=await W();
  check(w.activities.length===0&&w.categories.length===0&&!w.candidate.name,"new exercise is blank — previous candidate's work isolated");
  await page.setInputFiles("#filePick",file);
  await page.waitForTimeout(200);
  w=await W();
  check(w.candidate.name==="Jordan Sample"&&w.activities.length===exported.activities.length&&JSON.stringify(w.schedules)===JSON.stringify(exported.schedules),"import restores the plan exactly");
  check(await page.isHidden("#intro"),"import continues straight into the plan");
  await page.click("#btnFile");
  check(await page.locator('#menu button:has-text("Restore previous exercise")').count()===1,"file menu offers to restore the exercise that was set aside");
  await page.keyboard.press("Escape");
  // reject bad files
  fs.writeFileSync(path.join(OUT,"bad.json"),'{"hello":1}');
  await page.setInputFiles("#filePick",path.join(OUT,"bad.json"));
  await page.waitForTimeout(100);
  check((await page.textContent("#toast")).includes("isn't a Manager Interview Sandbox plan"),"unrelated JSON is rejected");
  check((await W()).candidate.name==="Jordan Sample","rejected import leaves the plan untouched");
  // malicious content stays inert
  const evil=JSON.parse(JSON.stringify(exported)); evil.candidate.name='<img src=x onerror="window.__xss=1">'; evil.categories[0].color='red;background:url(javascript:1)';
  fs.writeFileSync(path.join(OUT,"evil.json"),JSON.stringify(evil));
  await page.setInputFiles("#filePick",path.join(OUT,"evil.json")); await page.waitForTimeout(100);
  if(await page.isVisible("#cmOk")) await page.click("#cmOk");
  await page.waitForTimeout(100);
  check(!(await page.evaluate(()=>window.__xss))&&(await W()).categories[0].color==="#9CA3AF","imported text is escaped and colours are validated");
  await page.setInputFiles("#filePick",file); await page.waitForTimeout(100); if(await page.isVisible("#cmOk")) await page.click("#cmOk");

  step("14. Two tabs: the stale tab stops saving");
  const p2=await ctx.newPage(); await p2.goto(URL);
  await p2.click('nav.seg [data-view="month"]');
  await p2.fill('#sidePri','changed in tab 2'); await p2.press('#sidePri','Tab'); await p2.waitForTimeout(500);
  await page.waitForTimeout(200);
  check((await page.textContent("#saveState")).includes("another tab")&&await page.isVisible("#banner"),"first tab warns that the plan changed elsewhere");
  await p2.close();
  await page.reload();

  step("15. Click every visible control in each view (crash sweep)");
  for(const v of ["players","month","daily","overview"]){
    await page.click(`nav.seg [data-view="${v}"]`);
    const n=await page.locator("main button:visible").count();
    for(let i=0;i<n;i++){
      const btn=page.locator("main button:visible").nth(i);
      if(!(await btn.count())) break;
      const txt=(await btn.textContent()||"").trim();
      if(/Delete|Clear|Start a new/i.test(txt)) continue;
      try{ await btn.click({timeout:1000}); }catch(e){}
      await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
      if(await page.isVisible("#intro")) await page.click("#inStart");
      await page.click(`nav.seg [data-view="${v}"]`).catch(()=>{});
    }
  }
  check(errors.length===0,`no page errors during the whole run${errors.length?": "+errors.slice(0,3).join(" | "):""}`);
  check(external.length===0,`no external network requests${external.length?": "+external.slice(0,3).join(", "):""}`);

  step("16. A saved V1 exercise opens and keeps working");
  const ctx1=await browser.newContext({viewport:{width:1440,height:900}});
  const p1=await ctx1.newPage(); const err1=[]; p1.on("pageerror",e=>err1.push(e.message));
  await p1.goto(URL);
  const v1path=path.join(__dirname,"fixtures","v1-exercise.json"), v1=JSON.parse(fs.readFileSync(v1path,"utf8"));
  check(v1.schema===1&&!v1.evals,"fixture is a real V1 export (schema 1, no evaluations)");
  await p1.setInputFiles("#filePick",v1path); await p1.waitForTimeout(200);
  let w1=await p1.evaluate(()=>JSON.parse(JSON.stringify(window.MIS.W)));
  const strip=o=>JSON.parse(JSON.stringify(o,(k,v)=>k==="playerId"?undefined:v));
  check(w1.candidate.name===v1.candidate.name&&JSON.stringify(strip(w1.activities))===JSON.stringify(v1.activities)&&JSON.stringify(strip(w1.schedules))===JSON.stringify(v1.schedules)&&JSON.stringify(w1.categories)===JSON.stringify(v1.categories)&&JSON.stringify(w1.weeks)===JSON.stringify(v1.weeks),"V1 activities, schedules, categories and weekly focus import unchanged");
  check(JSON.stringify(w1.evals)==="{}"&&w1.activities.every(a=>a.playerId===null),"V1 data gets empty evaluations and no player links");
  await p1.click('nav.seg [data-view="players"]');
  await p1.click('[data-case-open="of"]'); await p1.fill('textarea[data-case="of"][data-evf="priority"]','Swing decisions early in counts.');
  await p1.click('nav.seg [data-view="daily"]');
  check(await p1.locator(".dtab:not(.add)").count()===2,"both V1 daily schedules open");
  await p1.fill('[data-sf="notes"]','edited after upgrade'); await p1.press('[data-sf="notes"]','Tab');
  await p1.waitForTimeout(500); await p1.reload();
  w1=await p1.evaluate(()=>JSON.parse(JSON.stringify(window.MIS.W)));
  check(w1.evals.of.priority==="Swing decisions early in counts."&&Object.values(w1.schedules).some(S=>S.notes==="edited after upgrade")&&w1.activities.length===v1.activities.length,"upgraded V1 exercise saves new evaluation work alongside its old plan");
  check(err1.length===0,"no page errors with V1 data");
  await ctx1.close();

  step("17. Tablet width");
  await page.setViewportSize({width:1024,height:768});
  await page.click('nav.seg [data-view="month"]');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  check(overflow<=1,`no horizontal overflow at 1024px (${overflow}px)`);
  await shot("07-tablet");

  await browser.close(); srv.close();
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
