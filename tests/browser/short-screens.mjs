import { chromium } from "playwright";
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const problems=[];
const check=(ok,m)=>{if(!ok)problems.push(m);console.log(`  ${ok?"PASS":"FAIL"}  ${m}`);};
const b=await chromium.launch();

// Short viewports: a phone in landscape, and a phone with the keyboard open.
for (const vp of [{n:"360x420 (very short)",width:360,height:420},{n:"740x360 (landscape)",width:740,height:360}]) {
  console.log(`\n### ${vp.n}`);
  const ctx=await b.newContext({viewport:{width:vp.width,height:vp.height}});
  const p=await ctx.newPage();
  await p.goto(`${BASE}/assessment`,{waitUntil:"networkidle"});
  await p.waitForSelector("h1");

  const scroller = p.locator(".overflow-y-auto").first();
  const info = await scroller.evaluate((el)=>({scrollH:el.scrollHeight, clientH:el.clientHeight}));
  check(info.scrollH > info.clientH, `content overflows and the step region is scrollable (${info.scrollH} > ${info.clientH})`);

  // The LAST option must be reachable by scrolling, and not sit under the bar.
  await scroller.evaluate((el)=>{el.scrollTop = el.scrollHeight;});
  await p.waitForTimeout(250);
  const reach = await p.evaluate(()=>{
    const labels=[...document.querySelectorAll("fieldset label")];
    const last=labels[labels.length-1];
    const bar=document.querySelector(".aion-sticky-actions");
    if(!last||!bar) return "missing";
    const l=last.getBoundingClientRect(), bb=bar.getBoundingClientRect();
    if (l.bottom > bb.top + 1) return `last option (bottom ${l.bottom.toFixed(0)}) sits under the bar (top ${bb.top.toFixed(0)})`;
    if (l.top < 0) return `last option scrolled above the viewport`;
    return "clear";
  });
  check(reach==="clear", `last option reachable and clear of the action bar (${reach})`);

  const overflowX = await p.evaluate(()=>({s:document.documentElement.scrollWidth,c:document.documentElement.clientWidth}));
  check(overflowX.s<=overflowX.c+1, `no horizontal overflow (${overflowX.s} <= ${overflowX.c})`);

  // The action bar must remain on screen.
  const barVisible = await p.evaluate(()=>{
    const b=document.querySelector(".aion-sticky-actions").getBoundingClientRect();
    return b.bottom <= window.innerHeight+1 && b.top >= 0;
  });
  check(barVisible, "action bar stays within the viewport");
  await ctx.close();
}

// Long result screen on a short viewport must scroll too.
console.log("\n### Long result screen, short viewport");
{
  const ctx=await b.newContext({viewport:{width:360,height:480}});
  const p=await ctx.newPage();
  async function pick(page,label,exact=false){await page.getByRole("group").getByText(label,exact?{exact:true}:undefined).click();await page.waitForTimeout(150);}
  await p.goto(`${BASE}/assessment?audience=real-estate`,{waitUntil:"networkidle"});
  await pick(p,"People inquire, but follow-up is inconsistent");
  await pick(p,"Referrals",true);
  await p.getByRole("button",{name:"Continue"}).click();await p.waitForTimeout(150);
  await pick(p,"We handle it manually through calls, texts, or DMs");
  await pick(p,"Listing promotion",true);
  await pick(p,"Yes, we need production support");
  await pick(p,"As soon as practical");
  await p.waitForTimeout(400);
  const scroller=p.locator(".overflow-y-auto").first();
  const info=await scroller.evaluate(el=>({s:el.scrollHeight,c:el.clientHeight}));
  check(info.s>info.c, `result content is scrollable on a 480px-tall screen (${info.s} > ${info.c})`);
  await scroller.evaluate(el=>{el.scrollTop=el.scrollHeight;});
  await p.waitForTimeout(250);
  const noteVisible=await p.getByText("This is a starting point based on your answers").isVisible();
  check(noteVisible,"the scope note at the very bottom of the card is reachable");
  const cta=await p.getByRole("button",{name:"Discuss My Growth Plan"}).isVisible();
  check(cta,"the primary CTA stays visible while scrolling");
  await ctx.close();
}

await b.close();
console.log("\n"+"=".repeat(60));
if(problems.length===0)console.log("ALL CHECKS PASSED");
else{console.log(`${problems.length} PROBLEM(S):`);problems.forEach(x=>console.log(" - "+x));process.exitCode=1;}
