/* End-to-end candidate workflow for the Manager Interview Hub.
   Serves the repo from a GitHub-Pages-like subpath (/manager-sandbox/) and
   drives the app in Chromium through Playwright.

     node tests/e2e.js            # run
     SHOTS=1 node tests/e2e.js    # also write screenshots to tests/output/
*/
const http=require("http"), fs=require("fs"), path=require("path");
const {chromium}=require("playwright");

const ROOT=path.resolve(__dirname,".."), OUT=path.join(__dirname,"output"), FIX=path.join(__dirname,"fixtures");
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
  const hideToast=()=>page.evaluate(()=>document.getElementById("toast").classList.remove("on"));
  /* click inside a day cell's empty space — that opens Add activity */
  const clickDay=iso=>page.click(`.dc[data-dropday="${iso}"]`,{position:{x:70,y:95}});

  step("1. Welcome page");
  await page.goto(URL);
  check(await page.isVisible("#intro"),"welcome page is shown on first open");
  const intro=await page.textContent("#intro");
  check(intro.includes("Manager Interview Hub")&&intro.includes("Double-A Manager Interview Exercise")&&intro.includes("Objective")&&intro.includes("Build a Monthly Plan")&&intro.includes("Save and Submit")&&intro.includes("export a backup"),"welcome page carries the objective, the three-part assignment and the notes");
  let w=await W();
  check(w.activities.length===0&&Object.keys(w.schedules).length===0&&w.categories.length===0,"workspace starts blank — nothing preloaded");
  await page.fill("#inName","Jordan Sample");
  await page.selectOption("#inMonth","5"); await page.fill("#inYear","2027");
  await shot("01-welcome");
  await page.click("#inStart");
  check(await page.isHidden("#intro")&&await page.isVisible("#viewMonth.on"),"Start Planning opens the Monthly Planner");
  check((await page.textContent("#calTitle")).includes("June 2027"),"planning month set to June 2027");
  check(await page.locator(".ac").count()===0,"the calendar begins empty");

  step("2. Navigation is two workspaces; evaluations and the overview are gone");
  const tabs=await page.locator("nav.seg [role=tab]").allTextContents();
  check(tabs.length===2&&/Monthly Planner/.test(tabs[0])&&/Daily Schedule/.test(tabs[1]),`tabs: ${tabs.map(t=>t.replace(/\s+/g," ").trim()).join(" | ")}`);
  const body=await page.textContent("body");
  check(!/Player Evaluation|Review & Export|Prescription|Kowalczyk|Ibarra/.test(body),"no player-evaluation or overview interface remains");
  check(await page.locator("#side,.side,[data-case-open],#viewPlayers,#viewOverview").count()===0,"no sidebar, case tabs or overview view in the DOM");
  check(await page.isVisible("#btnHelp")&&await page.isVisible("#btnExport"),"header has one Export button and a ? help button");

  step("3. Add monthly activities — suggestions and custom");
  await clickDay("2027-06-08");
  check(await page.isVisible("#pop.on"),"clicking a day opens Add activity");
  const groups=await page.locator("#pop .al-h").allTextContents();
  check(groups.join("|")==="Team Defense|Offense|Individual / Position Work|Other","suggestions grouped: Team Defense, Offense, Individual / Position Work, Other");
  check(await page.locator("#pop .al-c[data-preset]").count()===20&&await page.locator("#pop [data-presetcustom]").count()===1,"20 suggested activities plus Custom Activity");
  await shot("02-add");
  await page.click('#pop [data-preset="Bunt Defense"]');
  check((await page.inputValue('#pop [data-addf="name"]'))==="Bunt Defense","picking a suggestion fills the name");
  await page.click("#pop [data-addgo]");
  w=await W();
  let a=w.activities.find(x=>x.title==="Bunt Defense");
  check(a&&a.date==="2027-06-08"&&a.color==="#002D62","added on Jun 8 with the Team Defense colour");
  // filtering + renaming a suggestion
  await clickDay("2027-06-09");
  await page.fill('#pop [data-addf="name"]',"relay");
  check(await page.locator("#pop .al-c[data-preset]:visible").count()===1&&await page.isVisible('#pop [data-preset="Cutoffs & Relays"]'),"typing filters the suggestions");
  await page.click('#pop [data-preset="Cutoffs & Relays"]'); await page.click("#pop [data-addgo]");
  await clickDay("2027-06-09");
  await page.click('#pop [data-preset="PFP"]');
  await page.fill('#pop [data-addf="name"]',"PFP — comebackers & covers");
  await page.press('#pop [data-addf="name"]',"Enter");
  check((await W()).activities.some(x=>x.title==="PFP — comebackers & covers"&&x.color==="#002D62"),"a suggestion can be renamed before adding (keeps its colour)");
  // custom activity with the header button, time, colour and a note
  await page.click("#btnAddAct");
  await page.fill('#pop [data-addf="date"]',"2027-06-10");
  await page.click("#pop [data-presetcustom]");
  await page.fill('#pop [data-addf="name"]',"Early work — hitters");
  await page.fill('#pop [data-addf="time"]',"2:30");
  await page.click('#pop [data-swk="add"][data-sw="#1E8A5A"]');
  await page.fill('#pop [data-addf="notes"]',"Two-strike approach");
  await page.click("#pop [data-addgo]");
  a=(await W()).activities.find(x=>x.title==="Early work — hitters");
  check(a&&a.date==="2027-06-10"&&a.time==="2:30"&&a.color==="#1E8A5A"&&a.notes==="Two-strike approach","＋ Add activity: custom name, date, time, colour and note");
  await clickDay("2027-06-11"); await page.click("#pop [data-addgo]");
  check(await page.isVisible("#pop.on")&&(await W()).activities.length===4,"adding with no name is refused (name is the only requirement)");
  await page.keyboard.press("Escape");
  check(!(await page.isVisible("#pop.on")),"Escape closes the popover");
  await clickDay("2027-06-11");
  check(await page.locator('#pop .al-h:has-text("Your activities")').count()===1&&await page.isVisible('#pop [data-preset="Early work — hitters"]'),"the candidate's own activities are offered for reuse");
  await page.keyboard.press("Escape");
  await page.fill('[data-pri]',"Clean fundamentals; catchers as leaders");
  await page.press('[data-pri]',"Tab");
  await page.fill('[data-weekfocus="2027-06-07"]','Defensive communication');
  await page.press('[data-weekfocus="2027-06-07"]','Tab');
  w=await W();
  check(w.priorities==="Clean fundamentals; catchers as leaders"&&w.weeks["2027-06-07"].focus==="Defensive communication","month priorities and weekly focus saved");
  await shot("03-month");

  step("4. Edit, repeat, duplicate, move and remove activities");
  await page.click('.ac:has-text("Early work")');
  check(await page.isVisible("#pop.on")&&(await page.inputValue('#pop [data-ap="title"]'))==="Early work — hitters","clicking an activity opens its editor");
  await page.fill('#pop [data-ap="time"]','2:45');
  await page.click('#pop [data-swk="ap"][data-sw="#7A4BC4"]');
  await page.click('#pop [data-aprepeat]'); await page.click('#pop [data-repgo]');
  w=await W();
  let ew=w.activities.filter(x=>x.title==="Early work — hitters");
  check(ew.length===3&&ew.every(x=>x.seriesId===ew[0].seriesId&&x.time==="2:45"&&x.color==="#7A4BC4"),"weekly repeat through month end: Jun 10, 17, 24 with time and colour");
  await page.check('#pop [data-apall]');
  await page.fill('#pop [data-ap="title"]','Early work (hitters)');
  check((await W()).activities.filter(x=>x.title==="Early work (hitters)").length===3,"rename applies to the whole series when asked");
  await page.click('#pop [data-apdup]');
  check((await W()).activities.filter(x=>x.title==="Early work (hitters)").length===4,"duplicate");
  await page.click('#pop [data-apdel]');
  check((await W()).activities.filter(x=>x.title==="Early work (hitters)").length===3,"delete");
  await page.keyboard.press("Control+z");
  check((await W()).activities.filter(x=>x.title==="Early work (hitters)").length===4,"Ctrl+Z restores a deleted activity");
  await page.keyboard.press("Control+z");
  await hideToast();
  await page.locator('.ac:has-text("Cutoffs & Relays")').dragTo(page.locator('.dc[data-dropday="2027-06-12"]'),{targetPosition:{x:70,y:90}});
  check((await W()).activities.find(x=>x.title==="Cutoffs & Relays").date==="2027-06-12","drag moves an activity to another day");
  await page.keyboard.down("Alt");
  await page.locator('.ac:has-text("Bunt Defense")').dragTo(page.locator('.dc[data-dropday="2027-06-15"]'),{targetPosition:{x:70,y:90}});
  await page.keyboard.up("Alt");
  check((await W()).activities.filter(x=>x.title==="Bunt Defense").map(x=>x.date).sort().join()==="2027-06-08,2027-06-15","Alt-drag copies (original kept)");
  await page.locator('.ac:has-text("Cutoffs & Relays")').dragTo(page.locator('.dc[data-dropday="2027-06-09"]'),{targetPosition:{x:70,y:90}});
  // the activity editor's suggestions
  await page.click('.ac:has-text("Bunt Defense") >> nth=1');
  await page.fill('#pop [data-ap="title"]','Rund');
  check(await page.isVisible("#combo.on")&&(await page.textContent("#combo")).includes("Rundowns"),"the activity editor offers the same suggestions");
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  w=await W();
  check(w.activities.some(x=>x.date==="2027-06-15"&&x.title==="Rund"),"…but free text is always allowed");
  await page.click('.ac:has-text("Rund")'); await page.click('#pop [data-apdel]');

  step("5. Day panel → first daily schedule");
  await page.click('.dc[data-dropday="2027-06-09"] .dc-n');
  check(await page.isVisible("#drawer.on"),"clicking a date number opens the day");
  await page.fill('[data-dayf="tag"]','Home vs. Opponent');
  await page.fill('[data-dayf="notes"]','Getaway day tomorrow.');
  await page.click('#drawer [data-addday]');
  await page.click('#pop [data-preset="Team Meeting"]'); await page.click("#pop [data-addgo]");
  check((await W()).activities.filter(x=>x.date==="2027-06-09").length===3&&(await W()).activities.some(x=>x.date==="2027-06-09"&&x.title==="Team Meeting"),"＋ Add activity from the day panel");
  await page.click('[data-dritemcolor] >> nth=0'); await page.click('#menu [data-sw="#C8102E"]');
  check((await W()).activities.filter(x=>x.date==="2027-06-09").sort((a,b)=>a.order-b.order)[0].color==="#C8102E","colour changed from the day panel");
  await shot("04-drawer");
  await page.click('[data-drsched]');
  check(await page.isVisible("#viewDaily.on"),"Build daily schedule opens Daily Schedule");
  w=await W(); let S=w.schedules["2027-06-09"];
  check(S&&S.context==="Home vs. Opponent"&&S.submit===true,"schedule created (context from the day label, included in the submission)");

  step("6. Build the daily schedule");
  await page.fill('[data-sf="title"]','Pregame Practice');
  await page.fill('[data-sf="location"]','Home ballpark');
  const sec0=S.sections[0].id;
  await page.fill(`[data-secf="name"][data-sec="${sec0}"]`,'Full team');
  const t0=`[data-sec="${sec0}"][data-rf="time"] >> nth=0`;
  await page.fill(t0,'1230-1250'); await page.press(t0,'Tab');
  await page.keyboard.type('Stretch & throw'); await page.keyboard.press('Escape'); await page.keyboard.press('Tab');
  await page.keyboard.type('Field'); await page.keyboard.press('Tab');
  await page.keyboard.type('S&C coach'); await page.keyboard.press('Enter');
  S=(await W()).schedules["2027-06-09"];
  check(S.sections[0].rows[0].time==="12:30"&&S.sections[0].rows[0].timeEnd==="12:50","\"1230-1250\" becomes 12:30 – 12:50");
  check(S.sections[0].rows.length===2&&S.sections[0].rows[1].time==="12:50","Enter adds a row starting where the last ended");
  await page.keyboard.type('12:50-1:20'); await page.keyboard.press('Tab');
  check(await page.isVisible("#combo.on")&&(await page.textContent("#combo")).includes("Team Defense"),"activity cell offers the baseball suggestions");
  await page.keyboard.type('Rundo');
  await page.click('#combo .opt:has-text("Rundowns")');
  S=(await W()).schedules["2027-06-09"];
  check(S.sections[0].rows[1].activity==="Rundowns"&&S.sections[0].rows[1].color==="#002D62","picking a suggestion fills the row and its colour");
  const act1=`[data-sec="${sec0}"][data-rf="activity"] >> nth=1`;
  await page.fill(act1,'My own drill'); await page.press(act1,'Tab');
  check((await W()).schedules["2027-06-09"].sections[0].rows[1].activity==="My own drill","custom row names are free text");
  await page.click('.planned .pchip:has-text("Team Meeting")');
  S=(await W()).schedules["2027-06-09"];
  check(S.sections[0].rows.some(r=>r.activity==="Team Meeting"&&r.src),"a monthly activity is added from the strip at the top");
  check(await page.locator('.planned .pchip.done').count()>=1,"the strip marks monthly activities already on the schedule");
  await page.fill(t0,'12:40-1:00'); await page.press(t0,'Tab');
  check(await page.isVisible("#pill.on"),"changing a start time offers to push the rows below");
  await page.click('#pill [data-shift="section"]');
  S=(await W()).schedules["2027-06-09"];
  check(S.sections[0].rows[1].time==="1:00"&&S.sections[0].rows[1].timeEnd==="1:30","rows below pushed +10 min");
  await page.click(act1); await page.keyboard.press('Alt+d'); await page.keyboard.type('IF/OF communication');
  await page.click(act1); await page.keyboard.press('Control+d');
  check((await W()).schedules["2027-06-09"].sections[0].rows.length===4,"Ctrl+D duplicates a row");
  await page.keyboard.press('Control+Backspace');
  check((await W()).schedules["2027-06-09"].sections[0].rows.length===3,"Ctrl+Backspace deletes a row");
  await page.click('[data-rowcolor] >> nth=0'); await page.click('#menu [data-sw="#EB6E1F"]');
  check((await W()).schedules["2027-06-09"].sections[0].rows[0].color==="#EB6E1F","row colour from its dot");
  await page.click('[data-addsec="0.5"]'); await page.keyboard.type('Pitchers');
  await page.click('.secgap'); await page.keyboard.type('Position players');
  S=(await W()).schedules["2027-06-09"];
  check(S.sections.length===3&&S.sections[1].name==="Pitchers"&&S.sections[1].width===.5&&S.sections[2].width===.5,"two half-width sections share a row");
  const pit=S.sections[1].id;
  await page.fill(`[data-secf="who"][data-sec="${pit}"]`,'Starters + relievers');
  await page.fill(`[data-sec="${pit}"][data-rf="time"]`,'3:00-3:20'); await page.press(`[data-sec="${pit}"][data-rf="time"]`,'Tab');
  await page.keyboard.type('Bullpens'); await page.keyboard.press('Escape');
  await page.click('#addRotation');
  await page.fill('#rgName','Defensive stations');
  await page.fill('#rgGroups','Infielders, Outfielders, Catchers');
  await page.fill('#rgStations','Double plays, Fly balls, Blocking');
  await page.fill('#rgStart','2:00'); await page.fill('#rgLen','12'); await page.fill('#rgGap','3');
  await page.click('#rgGo');
  const g=(await W()).schedules["2027-06-09"].sections.find(s=>s.kind==="grid");
  check(g&&g.columns.length===3&&g.rows.length===3&&g.rows[1].time==="2:15","stations / rotation grid");
  await hideToast();
  const before=(await W()).schedules["2027-06-09"].sections[1].rows.length;
  await mouseDrag(page,page.locator(`[data-rowsof="${sec0}"] [data-rowgrip] >> nth=2`),page.locator(`[data-rowsof="${pit}"] .row >> nth=0`));
  check((await W()).schedules["2027-06-09"].sections[1].rows.length===before+1,"drag a row into another section");
  await page.keyboard.press("Control+z");
  await shot("05-daily");

  step("7. Second daily schedule and submission choice");
  await page.click('#dNew'); await page.click('[data-pickdate="2027-06-15"]');
  S=(await W()).schedules["2027-06-15"];
  check(!!S&&S.submit===true,"second schedule created and included in the submission");
  await page.click('#schCopyFrom'); await page.click('#clGo');
  await page.fill('[data-sf="title"]','Off-day Workout');
  const s15=(await W()).schedules["2027-06-15"].sections[0].id;
  await page.fill(`[data-sec="${s15}"][data-rf="time"]`,'10-11'); await page.press(`[data-sec="${s15}"][data-rf="time"]`,'Tab');
  await page.keyboard.type('Bunt Defense'); await page.keyboard.press('Escape');
  await page.click('#dNew'); await page.click('[data-pickdate="2027-06-20"]');
  check((await W()).schedules["2027-06-20"].submit===false,"a third schedule is allowed and not auto-selected");
  await page.click('[data-submit="2027-06-20"]');
  check((await W()).schedules["2027-06-20"].submit===true&&(await page.textContent("#daily .dtabs")).includes("★"),"☆ Add to submission marks a day (★ in its tab)");
  await page.click('[data-submit="2027-06-20"]');
  await page.click('[data-dtab="2027-06-09"]');
  check((await page.inputValue('[data-sf="title"]'))==="Pregame Practice","tabs switch between schedules");
  await page.click('[data-tomonth]');
  check(await page.isVisible("#viewMonth.on")&&await page.isVisible("#drawer.on"),"‹ Month view returns to the calendar with that day open");
  await page.click('[data-drclose]');
  check(await page.locator('[data-schedopen="2027-06-09"]').count()===1,"calendar shows the daily-schedule badge");
  await page.click('[data-mmode="week"]');
  check(await page.locator('.wv-col').count()===7,"week view");
  await page.click('.wv-list >> nth=4',{position:{x:30,y:150}});
  check(await page.isVisible("#pop.on")&&(await page.textContent("#pop")).includes("Add activity"),"week view: click a day column to add");
  await page.keyboard.press("Escape");
  await page.click('[data-mmode="month"]');

  step("8. Help");
  await page.click("#btnHelp");
  const help=await page.textContent("#modal");
  check(/What to submit/.test(help)&&/Add and edit monthly activities/.test(help)&&/Suggested baseball activities/.test(help)&&/Build a daily schedule/.test(help)&&/Saving, exporting and importing/.test(help),"? opens instructions covering every topic");
  await shot("06-help");
  await page.click('#modal .mfoot [data-close]');
  check(!(await page.isVisible("#scrim.on")),"help closes with its Close button");
  await page.click("#btnHelp"); await page.keyboard.press("Escape");
  check(!(await page.isVisible("#scrim.on")),"…and with Escape");
  await page.click("nav.seg [data-view=daily]"); await page.click("#btnHelp");
  check(await page.isVisible("#scrim.on"),"help is available from Daily Schedule too");
  await page.click('#helpWelcome');
  check(await page.isVisible("#intro"),"help can reopen the welcome page");
  await page.click("#inStart");

  step("9. Save and reload");
  await page.waitForTimeout(500);
  const beforeReload=await W();
  await page.reload();
  check(await page.isHidden("#intro"),"returning candidate skips the welcome page");
  check(JSON.stringify(await W())===JSON.stringify(beforeReload),"everything survives a reload exactly");

  step("10. Export: PDFs and JSON backup");
  const pdfs={};
  for(const [kind,date] of [["month"],["daily","2027-06-09"],["submission"]]){
    await page.evaluate(([k,d])=>window.MIS.buildPrint(k,d),[kind,date]);
    await page.emulateMedia({media:"print"});
    const buf=await page.pdf({format:"Letter",landscape:kind==="month",preferCSSPageSize:true,printBackground:true});
    fs.writeFileSync(path.join(OUT,`print-${kind}.pdf`),buf);
    pdfs[kind]=pdfPages(buf);
    await page.emulateMedia({media:"screen"});
  }
  check(pdfs.month===2,`monthly calendar PDF: calendar + details = ${pdfs.month} pages`);
  check(pdfs.daily===1,`daily schedule PDF fits on one page: ${pdfs.daily}`);
  check(pdfs.submission===5,`submission = cover + calendar + details + the 2 selected days: ${pdfs.submission} pages`);
  const ptxt=await page.evaluate(()=>window.MIS.buildPrint("submission")&&document.getElementById("printRoot").innerText);
  check(ptxt.includes("Pregame Practice")&&ptxt.includes("Off-day Workout")&&ptxt.includes("Defensive communication")&&ptxt.includes("Two-strike approach")&&!ptxt.includes("Sunday, June 20"),"submission carries the plan and the two selected days only");
  await page.click("#btnExport");
  const xtxt=await page.textContent("#modal");
  check(/Complete Interview Submission/.test(xtxt)&&/Monthly Calendar/.test(xtxt)&&/Daily Schedule/.test(xtxt)&&/JSON Backup/.test(xtxt),"one Export dialog with the four choices");
  check(await page.locator("#modal [data-xsub]").count()===3&&await page.locator("#modal [data-xsub]:checked").count()===2,"submission days are chosen with checkboxes (2 of 3 checked)");
  await shot("07-export");
  await page.click('#modal [data-xgo="submission"]'); await page.waitForTimeout(150);
  await page.click("#btnExport"); await page.selectOption("#xDay","2027-06-15"); await page.click('#modal [data-xgo="daily"]'); await page.waitForTimeout(150);
  await page.click("#btnExport"); await page.click('#modal [data-xgo="month"]'); await page.waitForTimeout(150);
  check(await page.evaluate(()=>window.__prints)===3,"each PDF choice opens the print dialog");
  await page.click("#btnExport");
  const [dl]=await Promise.all([page.waitForEvent("download"),page.click('#modal [data-xgo="json"]')]);
  const file=path.join(OUT,dl.suggestedFilename()); await dl.saveAs(file);
  const exported=JSON.parse(fs.readFileSync(file,"utf8"));
  check(/jordan-sample_2027-06\.json$/.test(file)&&exported.schema===3&&exported.activities.length===beforeReload.activities.length&&Object.keys(exported.schedules).length===3,"JSON backup contains the whole exercise");
  await page.keyboard.press("Escape");

  step("11. New exercise → import the backup");
  await page.click("#btnExport"); await page.click('#modal [data-xgo="new"]'); await page.click("#cmOk");
  check(await page.isVisible("#intro"),"new exercise returns to the welcome page");
  w=await W();
  check(w.activities.length===0&&!w.candidate.name&&!Object.keys(w.schedules).length,"new exercise is blank");
  await page.setInputFiles("#filePick",file); await page.waitForTimeout(200);
  w=await W();
  check(w.candidate.name==="Jordan Sample"&&JSON.stringify(w.activities)===JSON.stringify(exported.activities)&&JSON.stringify(w.schedules)===JSON.stringify(exported.schedules),"import restores the exercise exactly");
  fs.writeFileSync(path.join(OUT,"bad.json"),'{"hello":1}');
  await page.setInputFiles("#filePick",path.join(OUT,"bad.json")); await page.waitForTimeout(100);
  check((await page.textContent("#toast")).includes("isn't a Manager Interview Hub backup")&&(await W()).candidate.name==="Jordan Sample","unrelated JSON is rejected");
  const evil=JSON.parse(JSON.stringify(exported)); evil.candidate.name='<img src=x onerror="window.__xss=1">'; evil.activities[0].color='red;background:url(javascript:1)';
  fs.writeFileSync(path.join(OUT,"evil.json"),JSON.stringify(evil));
  await page.setInputFiles("#filePick",path.join(OUT,"evil.json")); await page.waitForTimeout(100);
  if(await page.isVisible("#cmOk")) await page.click("#cmOk");
  await page.waitForTimeout(100);
  check(!(await page.evaluate(()=>window.__xss))&&(await W()).activities[0].color===null,"imported text is escaped and colours are validated");
  await page.setInputFiles("#filePick",file); await page.waitForTimeout(100); if(await page.isVisible("#cmOk")) await page.click("#cmOk");

  step("12. Older saved files still open");
  for(const [name,ver] of [["v1-exercise.json",1],["v2-exercise.json",2]]){
    const c=await browser.newContext({viewport:{width:1440,height:900}}), p=await c.newPage(), errs=[];
    p.on("pageerror",e=>errs.push(e.message));
    await p.goto(URL);
    const src=JSON.parse(fs.readFileSync(path.join(FIX,name),"utf8"));
    await p.setInputFiles("#filePick",path.join(FIX,name)); await p.waitForTimeout(200);
    const x=await p.evaluate(()=>JSON.parse(JSON.stringify(window.MIS.W)));
    const catHex=id=>(src.categories.find(c=>c.id===id)||{}).color||null;
    check(src.schema===ver&&x.activities.length===src.activities.length&&x.activities.every((a,i)=>a.title===src.activities[i].title&&a.date===src.activities[i].date&&a.color===catHex(src.activities[i].catId)),`V${ver}: every activity kept, category colours carried onto the activity`);
    check(Object.keys(x.schedules).join()===Object.keys(src.schedules).join()&&Object.values(x.schedules).every((S,i)=>S.title===Object.values(src.schedules)[i].title&&S.sections.length===Object.values(src.schedules)[i].sections.length),`V${ver}: daily schedules kept`);
    check(Object.values(x.schedules).filter(S=>S.submit).length===2,`V${ver}: the first two schedules are selected for submission`);
    if(ver===2) check(JSON.stringify(x.evals)===JSON.stringify(src.evals)&&x.activities.filter(a=>a.playerId).length===src.activities.filter(a=>a.playerId).length,"V2: old evaluation text and player links are kept in the file (not shown)");
    await p.click('nav.seg [data-view="daily"]');
    check(await p.locator(".dtab:not(.add)").count()===Object.keys(src.schedules).length&&errs.length===0,`V${ver}: opens in Daily Schedule without errors`);
    await c.close();
  }

  step("13. Two tabs: the stale tab stops saving");
  const p2=await ctx.newPage(); await p2.goto(URL);
  await p2.click('nav.seg [data-view="month"]');
  await p2.fill('[data-pri]','changed in tab 2'); await p2.press('[data-pri]','Tab'); await p2.waitForTimeout(500);
  await page.waitForTimeout(200);
  check((await page.textContent("#saveState")).includes("another tab")&&await page.isVisible("#banner"),"first tab warns that the plan changed elsewhere");
  await p2.close(); await page.reload();

  step("14. Click every visible control (crash sweep)");
  for(const v of ["month","daily"]){
    await page.click(`nav.seg [data-view="${v}"]`);
    const n=await page.locator("main button:visible").count();
    for(let i=0;i<n;i++){
      const btn=page.locator("main button:visible").nth(i);
      if(!(await btn.count())) break;
      const txt=(await btn.textContent()||"").trim();
      if(/Delete|Clear|Start a new/i.test(txt)) continue;
      try{ await btn.click({timeout:1000}); }catch(e){}
      for(let k=0;k<3;k++) await page.keyboard.press("Escape");
      if(await page.isVisible("#intro")) await page.click("#inStart");
      await page.click(`nav.seg [data-view="${v}"]`).catch(()=>{});
    }
  }
  check(errors.length===0,`no page errors during the whole run${errors.length?": "+errors.slice(0,3).join(" | "):""}`);
  check(external.length===0,`no external network requests${external.length?": "+external.slice(0,3).join(", "):""}`);

  step("15. Tablet width");
  await page.setViewportSize({width:1024,height:768});
  await page.click('nav.seg [data-view="month"]');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  check(overflow<=1,`no horizontal overflow at 1024px (${overflow}px)`);
  await shot("08-tablet");

  await browser.close(); srv.close();
  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
