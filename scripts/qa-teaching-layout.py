#!/usr/bin/env python3
"""Run after a real admin login with agent-browser; writes layout and regression evidence."""
import subprocess,json,time,os
from pathlib import Path
BASE=os.environ.get('TEACHING_QA_BROWSER_URL','http://127.0.0.1:15173')
SESSION=os.environ.get('TEACHING_QA_BROWSER_SESSION','teaching-real')
out=Path(__file__).resolve().parents[2]/'output/playwright/teaching-implementation';out.mkdir(parents=True,exist_ok=True)
results=[]
def ab(*args,json_result=False):
 p=subprocess.run(['agent-browser','--session',SESSION]+(['--json'] if json_result else [])+list(args),capture_output=True,text=True,timeout=40)
 if p.returncode:raise RuntimeError(p.stderr or p.stdout)
 return json.loads(p.stdout)['data']['result'] if json_result else p.stdout
pages={'course-selection':'学期选课分配','assessments':'考试与等级结果','report-jobs':'班级成绩单生成任务','comments':'默认评语与内部关注','research':'老师教研','teachers':'教师交接与安全删除'}
for path in pages:
 ab('open',BASE+'/teaching/'+path)
 for _ in range(20):
  ready=ab('eval','!!document.querySelector(".tw-head")&&!document.querySelector(".tw-loading")',json_result=True)
  if ready:break
  time.sleep(.2)
 for w,h in [(1440,900),(768,1024),(390,844)]:
  ab('set','viewport',str(w),str(h))
  metrics=ab('eval','({width:innerWidth,document:document.documentElement.scrollWidth,title:document.querySelector(".tw-head h2")?.textContent,tables:Array.from(document.querySelectorAll(".tw-table-wrap")).map(e=>({container:e.clientWidth,content:e.scrollWidth})),errors:Array.from(document.querySelectorAll(".tw-alert.is-error")).map(e=>e.textContent)})',json_result=True)
  metrics.update({'path':path,'height':h,'passed':metrics['document']==w and bool(metrics.get('title')) and not metrics['errors']})
  results.append(metrics);ab('screenshot','--full',str(out/(path+'-'+str(w)+'.png')))
  (out/'responsive-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
  print(path,w,'PASS' if metrics['passed'] else 'FAIL',flush=True)
for w in [1920,2560]:
 ab('set','viewport',str(w),'1080');m=ab('eval','({width:innerWidth,document:document.documentElement.scrollWidth})',json_result=True);m.update({'path':'teachers','height':1080,'passed':m['document']==w});results.append(m)
for path in ['dashboard','classes','students','scores','transcripts','parents']:
 ab('open',BASE+'/'+path)
 time.sleep(.4)
 data=ab('eval','({path:location.pathname,headings:Array.from(document.querySelectorAll("h1,h2")).map(e=>e.textContent),hasTeachingStyles:!!document.querySelector(".teaching-workspace"),bodyWidth:document.documentElement.scrollWidth})',json_result=True)
 data['passed']=data['path']=='/'+path and bool(data['headings']) and not data['hasTeachingStyles'];results.append(data);print('old route',path,data['passed'],flush=True)
(out/'responsive-results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
(out/'browser-errors.txt').write_text(ab('errors'))
(out/'browser-console.txt').write_text(ab('console'))
print('Saved',len(results),'layout/regression observations.',flush=True)
