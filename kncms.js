var Kc=require('knuty');
var CLR=require('./kncolor.js');
var Cookie=require('cookie');
var Fs=require('fs');
var Http=require('http');
var Url=require('url');
var Cheerio=require('cheerio');
Kc.extend({MENU: {}, SS: {}, TODAY: {}, CON: {}, HISTORY: [], CSS: '', BLOCK: {},
//
  setting: function(op){
    var me=this;   
    op=op||{}; Kc.info(); for(var k in op){Kc.CFG[k]=op[k];}
    op.starter=op.starter||'index.html';
    op.template=op.template||'Template1.frm';
    var l=Kc.CFG.current.search(/nodejs/);
    if(l<0){op.current=op.current||Kc.CFG.current;}
    else{op.current=op.current||Kc.CFG.current.substr(0, l);}
    op.base=op.base||op.current+'/html';
    op.data=op.data||op.current+'/data';
    op.local=op.local||op.current+'/local';

    return op;
  },
//
  server: function(proc, op){
    var me=this;
    Kc.Fiber(function(){
      op=me.setting(op); op.port=op.port||me.CFG.port||'80';
      var l=me.CFG.current.search(/nodejs/);
      me.checkDir(['data', 'local'], me.CFG.current.substr(0, l));

      if(me.argv(0)){
        me.CON.today=me.argv(0); me.infoLog('日付変更しました。date=' + me.CON.today);
        me.CON.timesift=true;
      }else{
        me.CON.today=me.today('Y/M/D'); me.CON.timesift=false;
      }
      me.menuBuild(op);

      Kc.Server=Http.createServer(function(req, res){Kc.Fiber(function(){
        var error=true;
        me.menuBuild(op);
        Kc.sessionIn(req, res, op);
        Kc.analyzeRequest(req, res);
        switch(me.SS.PATH[1]){
         case 'rest':
          error=proc(me.SS, Kc);
          if(!error){Kc.sessionOut(req, res);}
          break;
         case 'image': error=Kc.putFile(res, op.base+'/image/'); break;
         case 'js': error=Kc.putFile(res, op.base+'/js/'); break;
         case 'json': error=Kc.putFile(res, op.base+'/json/'); break;
         case 'css': error=Kc.putExpand(res, op.base+'/css/'); break;
         case 'ext': error=Kc.putFile(res, op.base+'/ext/'); break;
         case 'src': error=Kc.putFile(res, op.base+'/src/'); break;
         case 'cms': error=Kc.putFile(res, op.base+'/cms/'); break;
         case 'frame': error=Kc.putFile(res, op.base+'/frame/'); break;
         case 'config': error=Kc.sendConfig(res); break;
         case 'repository': error=Kc.putFile(res, op.current+'/repository/'); break;
         case 'source': error=Kc.putEscape(res, op.base+'/source/'); break;
         case 'favicon.ico': error=Kc.putFile(res, op.base+'/image/'); break;
         case 'sitemap.xml': error=Kc.sitemap(res); break;
         case 'reload': me.menuBuild(op, true); error=false; 
          res.writeHead(200, {"Content-Type": "text/plane", "charset": "utf-8"}); res.end("OK");
          break;
         default:
          error=proc(me.SS, Kc);
          if(me.SS.GET.setdate){me.debugSetdate(res, op);}
          me.putHtml(me.SS.URI.pathname, op.base, res); me.SS.INFOJ=me.INFOJ;
          try{
            Fs.writeFileSync(op.data+'/ss_'+me.SS.cid+'.json', JSON.stringify(me.SS), 'utf8');
          }catch(e){
            me.sevierLog('Session File Write Error', e);
            me.infoLog('data', me.SS);
          }
        }
//
      }).run();}).listen(op.port);
      Kc.infoLog('サーバーが開始しました。 port:' + op.port);
    }).run();
  },
//
// sessionIn
//
  sessionIn: function(req, res, op, wk){
    var me=this; wk={};

    wk.cookies=me.getCookies(req);

    wk.cid=me.valCookies('cid');
    if(!wk.cid){
      wk.cid=Math.floor(Math.random()*100000000);
    }

    wk.token=Math.floor(Math.random()*100000000)+'/'+Math.floor(Math.random()*10000000);
    me.setCookies('cid', wk.cid); me.setCookies('token', wk.token);

    try{
      me.SS=JSON.parse(Fs.readFileSync(op.data+'/ss_'+wk.cid+'.json', 'utf8'));
      me.SS.cookies=wk.cookies;
    }catch(e){
      me.SS={};
    }
    me.SS.cid=wk.cid; me.SS.token=wk.token;
  },
//
// analyzeRequest
//
  analyzeRequest: function(req, res){
    var me=this;
    me.SS.URI=Url.parse(req.url);
    me.SS.PATH=me.SS.URI.pathname.split('/');
    me.SS.method=req.method; me.SS.headers=req.headers;
    me.SS.POST={}; me.SS.GET={};
    if(req.method=='POST'){
      var body = '';
      var wid=Kc.ready();
      req.on('data', function(data){body+=data;});
      req.on('end', function(){me.SS.POST=JSON.parse(body); Kc.post(wid);});
      Kc.wait();
    }
    if(me.SS.URI.query){
      var a=me.SS.URI.query.split("&");
      var b, i; for(i in a){b=a[i].split("="); me.SS.GET[b[0]]=b[1];}
    }
//
    if(me.SS.PATH[1]=='cms'){me.SS.Apli=me.SS.PATH[2];}
  },
//
// getCookies
//
  getCookies: function(req){
    var me=this; var key, value, i, x, y, f, out={};

    me.SS.cookies=[]; x=req.headers.cookie; key=''; value=''; f=0;
    
    if(x){
      for(i=0; i<x.length; i++){
        y=x.charAt(i);
        switch(y){
         case ' ': break;
         case ';': out[key]=value; key=''; value=''; f=0; break;
         case '=': f=1; break;
         default: if(f==0){key+=y;}else{value+=y;}
        }
      }
      if(key){out[key]=value;}
    }
    me.SS.cookies=out;
    return out;
  },
//
  setCookies: function(key, value){
    this.SS.cookies[key]=value;
  },
//
  valCookies: function(key){
    return this.SS.cookies[key];
  },
//
  putCookies: function(){
    var me=this; var out=[], x, i, j;
    
    i=0; for(j in me.SS.cookies){
      x='';
      x+=j+'='+me.SS.cookies[j]+';';
      x+='path=/;';
      x+='expires=;';
      out[i]=x;
      i++;
    }
    return out;
  },
//
// ctype コンテンツタイプを拡張子で変換
//
  ctype: function(mdf){
    return {
      'html': 'text/html', 'css': 'text/css', 'js': 'text/javascript', 'txt': 'text/plane',
      'xml': 'text/xml', 
      'png': 'image/png', 'gif': 'image/gif', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
      'ico': 'image/x-icon'
    }[mdf]||'plain/text';
  },
//
// 単純にファイルを転送
//
  putFile: function(res, base){
    var me=this; var i=me.SS.PATH.length-1, path=me.SS.PATH[i];
    Fs.readFile(base+path, function(err, data){
      if(err){
        me.infoLog('putFile 404:'+base+path);
        res.writeHead(404, 'NOT FOUND', {'content-type': 'text/html'});
        res.end();
      }else{
        res.writeHead(200, {
          "Content-Type": me.ctype(me.modifier(base+path)), "charset": "utf-8"
        });
        res.end(data);
      }
    });
  },
//
// putExpand CSSなどのパラメータ展開による出力
//
  putExpand: function(res, base){
    var me=this; var i=me.SS.PATH.length-1, path=me.SS.PATH[i];
    var bcolor=me.INFOJ['Basecolor']||'Ruby';
    var dt=CLR.setColor(bcolor);
    var d=CLR.setFont(''), i; for(i in d){dt[i]=d[i];}
    var txt=CLR.setCancel();
    if(Kc.isExist(base+path)){
      txt+=Fs.readFileSync(base+path, {encoding: 'utf-8'});
    }else{
      txt="File Not Found:"+base+path; Kc.infoLog(txt);
    }
    res.writeHead(200, {
      "Content-Type": me.ctype(me.modifier(base+path)), "charset": "utf-8"
    });
    res.end(me.parm(txt, dt), 'utf8');
  },
//
// putEscpae ソースをescapeして送信
//
  putEscape: function(res, base){
    var me=this; var i=me.SS.PATH.length-1, path=me.SS.PATH[i];
    
    try{
      var txt=Fs.readFileSync(base+path, {encoding: 'utf-8'});
      res.writeHead(200, {
        "Content-Type": "text/html", "charset": "utf-8"
      });
      res.end(me.escape(txt, true), 'utf8');
    }catch(e){
      me.errorLog("putEscape Read File", e);
      res.writeHead(404, {"Content-Type":  "text/html", "charset": "utf-8"});
      res.end('');
    }
  },
//
// sendConfig INFOJを送信
//
  sendConfig: function(res){
    var me=this; var a, i, data, con={};
    for(i in me.SS.INFOJ){
      if(i.search(/./)>0){
        a=i.split('.'); if(!con[a[0]]){con[a[0]]={};} con[a[0]][a[1]]=me.INFOJ[i];
      }else{
        con[i]=me.INFOJ[i];
      }
    }
    try{
      data=JSON.stringify(me.INFOJ);
    }catch(e){
      res.writeHead(404, {"Content-Type":  "text/plane", "charset": "utf-8"});
      res.end('404 NOT FOUND');
      return;
    }
    res.writeHead(200, {
      "Content-Type": 'text/plane', "charset": "utf-8"
    });
    res.end(data);
  },
//
// デバッグ用　timesift日付のセット
//
  debugSetdate: function(res, op){
    var me=this; var date;
    if(me.CFG.mode=='debug'){
      date=me.repby(me.SS.GET.setdate, '.', '/');
      me.CON.today=date; me.CON.timesift=true; me.CON.menuBuild='';
      me.menuBuild(op);
    }
  },
//
// putHTML 本来のCMS処理
//
  putHtml: function(url, base, res){
    var me=this; var code=200;
    var b=url.split('/'); if(b[b.length-1]==""){url=url+"index.html";}
    var a=url.split('.'); var n;
    if(!a[1]){
      a[0]+='/index'; a[1]='html'; url+='/index.html'; n=me.SS.PATH.length; me.SS.PATH[n]='';
    }else if(a[1]!='html'){
      res.writeHead(404, {"Content-Type":  "text/html", "charset": "utf-8"});
      res.end('ERROR 404');
    }

    var dt={}; dt['PARM']=""; var txt;
    try{
      if(!me.getInfoj(base)){
        res.writeHead(404, {"Content-Type":  "text/html", "charset": "utf-8"});
        res.end('ERROR putHTML');
        me.errorLog('GET CONFIG FILE');
        return;
      }else{
        if(!me.isExist(base+url)){
          a[a.length-1]="page"; var i, c=""; u=""; for(i in a){u=u+c+a[i]; c=".";}
          dt=me.pageinfo(base+u, base);
          if(!dt["BODY"]){dt=me.pageinfo(base+"/error404.page", base); code=404;}
//          b=dt["PARM"].split("\n");
//         var v;
//          for(i in b){v=me.unstring(b[i]); me.INFOJ[v[0]]=v[1];}
          me.layer(dt['PARM'].split("\n"));

          var data=me.INFOJ['menu_data']||'menu';

          me.INFOJ['url']=url;
          me.INFOJ['Short']=me.INFOJ['Short']||me.INFOJ['Title'];
          me.CSS=dt['CSS']||'';
          me.toolbox();

          if(Kc.isExist(base+"/template/"+me.INFOJ["Template"]+".htm")){
            txt=Fs.readFileSync(base+"/template/"+me.INFOJ["Template"]+".htm", {encoding: 'utf8'});
          }else{
            txt="Template Not Found:"+base+"/template/"+me.INFOJ["Template"]+".htm";
            Kc.infoLog(txt);
          }
        }else{
          if(Kc.isExist(base+url)){
            txt=Fs.readFileSync(base+url, {encoding: 'utf-8'});
          }else{
            txt="File Not Found:"+base+url; Kc.infoLog(txt);
          }
        }
      }
      res.writeHead(code, {
        "Content-Type": "text/html", "charset": "utf8", "Set-Cookie": me.putCookies()
      });
      res.end(me.expand(txt, base, dt), "utf8");
    }catch(e){
      me.sevierLog("putHtml", e);
      res.writeHead(404, {"Content-Type":  "text/html", "charset": "utf-8"});
      res.end('');
    }
  },
//
// getInfoj INFOJのためのcfgファイル読み込み
//
  getInfoj: function(base){
    var me=this; var a, f, k, v, i, j, d, r, l; var fn="index.cfg", path=me.SS.PATH;

    me.INFOJ=me.INFOJ||{}; me.INFOJ.base=base;
    l=path.length; if(l>2){me.INFOJ.Group=path[2];}else{me.INFOJ.Group="home";}
    if(path[l-1].search(/#/)>-1){me.INFOJ.level=l-1;}else{me.INFOJ.level=l-2;}
    for(i in path){
      if(i>0){
        try{
          r=me.getFs(base+fn); d=JSON.parse(r);
          for(j in d){
            f=true; if(d[j].CmsVersion){a=d[j].CmsVersion.split('-'); f=me.validation(a[1]);}
            if(f){for(k in d[j]){me.INFOJ[k]=d[j][k];}}
          }
        }catch(e){
          me.infoLog("getInfoj can't get file="+base+fn, e);
        }
      }
      fn="/"+path[i]+fn;
    }
    me.INFOJ['loaded']='yes';
    return me.INFOJ['CmsVersion'];
  },
//
// pageinfo ページインフォ
//
  pageinfo: function(fname, base){
    var me=this;

    if(!me.isExist(fname)){fname=base+'/error404.page';} var d=me.getText(fname, true);

    var f={}; var k='BODY'; var out=''; f['PARM']=""; f['BODY']=""; f['HISTORY']=''; f['CSS']='';
 
    if(d){
      if(d[0]){if(d[0].charCodeAt(0)==65279){d[0]=d[0].substr(1);}} // bom除去feff
      if(d[0]){if(d[0].charCodeAt(0)==65534){d[0]=d[0].substr(1);}} // bom除去fffe
      var a, b; for(var i in d){
        a=me.unstring(d[i]); a[1]=a[1]||'';
        if(a[0].charAt(0)=="-"){
          k=a[0].substr(1); if(!me.validation(a[1])){k='';}
        }else{
          if(k!=""){
            f[k]+=d[i]+"\n";
          }
        }
      }

      return f;
    }else{
      me.errorLog('pageinfo nothing');
      return {};
    }
  },
//
// layer INFOJの階層化対応
//
  layer: function(lines){
    var me=this;

    var i, v, g;
    g=''; for(i in lines){
      v=me.unstring(lines[i]);
      if(v[1]=="*"){
        g=v[0];
      }else{
        if(g){
          me.INFOJ[g+'.'+v[0]]=v[1];
        }else{
          if(v[0]){me.INFOJ[v[0]]=v[1];}
        }
      }
    }

  },
//
// expand HTMLへと拡張展開する
//
  expand: function(buf, base, dt){
    var me=this; var txt=me.parm(buf);
    var $=Cheerio.load(txt, {
      normalizeWhitespace: true,
      xmlMode: true
    });

    $=me.devCss($); $=me.devPage($, dt); $=me.devInclude($);
    $=me.devParts($); $=me.devFrame($); $=me.devBlock($);
    if(me.CFG.mode=='debug'){$=me.debugInfo($);}
    if(me.INFOJ['Use']=='responsive'){$=me.appendScript($, 'responsive');}
    return $.html();

  },
//
//
//
  appendScript: function($){
    var me=this;
    if(!me.INFOJ.Analytics){return $;}

    $('body').append('<script type="text/javascript" '+
      'src="//cdnjs.cloudflare.com/ajax/libs/jquery/2.1.1/jquery.min.js"> </script>');
    $('body').append('<script type="text/javascript" src="/repository/responsive.js"> </script>');
    $('body').append('<script language="javascript">RES.begin({loadConfig: "yes"});</script>');

    if(me.INFOJ['Analytics'].account){
      var x="<script> \n";
      x+="(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){";
      x+="(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),";
      x+="m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)";
      x+="})(window,document,'script','//www.google-analytics.com/analytics.js','ga');";
      x+="ga('create', '"+me.INFOJ['Analytics'].account+"', 'auto');";
      x+="ga('send', 'pageview');";
      x+="</script>";
      $('head').append(x);
    }

    return $;

  },
//
// devPage Attr[cms-page]を展開
//
  devPage: function($, dt){
    var me=this, f, txt;
    $('[cms-page]').each(function(){
      f=$(this).attr('cms-page');
      txt=me.parm(dt[f]);
      $(this).html(me.escape(txt));
    });
    return $;
  },
//
// [escape]セクションを文字エスケープ
//
  escape: function(x, force){
    force=force||false; var l0, l1;
    if(force){l0='<p class="odd">'; l1='<p class="even">';}else{l0='<p>'; l1='<p>';}

    var a=x.split("\n"), i, j, y, out="", f=force; if(f){out+='<p>';}
    var g=true; for(i in a){
      if(a[i].search(/\[escape\]/)>-1){f=true; if(g){out+=l0;}else{out+=l1;}}
      else if(a[i].search(/\[epacse\]/)>-1){f=false; out+='</p>';}
      else{
        if(f){
          y=a[i];
          if(y.length==0){
            out+="&nbsp;</p>\n";  if(g){out+=l0;}else{out+=l1;}
          }else{
            for(j=0; j<y.length; j++){
              switch(y.charAt(j)){
                case '<': out+='&lt;'; break;
                case '>': out+='&gt;'; break;
                case '&': out+='&amp;'; break;
                case ' ': out+='&nbsp;'; break;
                default: out+=y.charAt(j, 1);
              }
            }
            out+="&nbsp;</p>\n"; if(g){out+=l0;}else{out+=l1;}
          }
        }else{
          out+=a[i]+"\n";
        }
      }
      if(g){g=false;}else{g=true;}
    }
    if(f){out+="&nbsp;</p>\n";}
    return out;
  },
//
//devInclude Attr[cms-include]を展開
// 
  devInclude: function($){
    var me=this, f, txt;
    $('[cms-include]').each(function(){
      f=$(this).attr('cms-include');
      try{
        f='./parts/'+f+'.htm';
        txt=me.parm(Fs.readFileSync(f).toString());
      }catch(e){txt='NOT FOUND:'+f;}
      $(this).html(txt);
    });
    return $;

  },
//
// devParts Attr[cms-parts]を展開
//
  devParts: function($){
    var me=this, f, txt;

    $('[cms-parts]').each(function(){
      f=$(this).attr('cms-parts');
      switch(f){
       case "navbar": txt=me.navbar(); break;
       case "guide": txt=me.guide(); break;
       case "menu": txt=me.menu(); break;
       case "sidemenu": txt=me.sidemenu(); break;
       case "foot": txt=me.foot(); break;
       case "history": txt=me.history(); break;
       case "color": txt=me.color(); break;
       case "pankuzu": txt=me.pankuzu(); break;
       default : txt="[Not Found]"+f;
      }
      $(this).html(txt);
    });
    return $;
  },
//
// devFrame Attr[cms-frame]を展開
//
  devFrame: function($){
    var me=this;
    var data, fname, frame, dname, txt, base;

    base=me.INFOJ['base'];
    $('[cms-frame]').each(function(){
      frame=$(this).attr('cms-frame'); dname=$(this).attr('source');
      if(dname){
        try{
          dname=me.parm(base+'/json/'+dname+'.json'); data=me.getJson(dname);
        }catch(e){
          txt='<p>NOT FOUND:'+dname+'</p>';
        }
      }
      if(!txt){txt=me.develop(base+'/template/'+frame+'.frm', data);}
      if(!txt){txt='<p>'+me.error+'</p>';}
      $(this).html(txt);
    });
    return $;
  },
//
// devBlock Attr[cms-block]を展開
//
  devBlock: function($){
    var me=this, m, txt;

    $('[cms-block]').each(function(){
      m=$(this).attr('cms-block');
      if(me.BLOCK[m]){txt=me.parm(me.BLOCK[m]);}else{txt='<p>NOT FOUND:'+m+'</p>';}
      $(this).html(txt);
    });
    return $;
  },
//
// devCss Attr[cms-css]を展開
//
  devCss: function($){
    var me=this;
    var data, fname, frame, dname, txt, base;

    base=me.INFOJ['base'];
    $('[cms-css]').each(function(){
      if(me.CSS){$(this).html(me.parm(me.CSS));}
    });
    return $;
  },
//
// debug Info
//
  debugInfo: function($){
    var me=this;
    
    var ix, x='<div style="display: none; position: absolute; top: -5000px;">';
    
    x+="\nINFOJ"; for(ix in me.INFOJ){x+="\n<p>"+ix+'='+me.INFOJ[ix]+'</p>';}
    x+="\nCFG"; for(ix in me.CFG){x+="\n<p>"+ix+'='+me.CFG[ix]+'</p>';}

    x+='</div>'; $('body').append(x); return $;
  },
//
// pankuzu パンくずパーツ
// 
  pankuzu: function(){
    var me=this; var out, u, mem, base, mark, dt=[], i, j, k;
    mem=me.INFOJ['pankuzu_form']||'pankuzu'; mark=me.INFOJ['pankuzu_mark']||' &gt; ';
    base=me.INFOJ['base'];
    dt[0]={}; dt[0].url='/index.html'; dt[0].Title=me.MENU[0].short;
    if(me.SS.PATH.length==2){if(me.SS.PATH[1]!='' && me.SS.PATH[1]!='index.html'){
      dt[1]={}; dt[1].url='/'+me.SS.PATH[1];
      for(j in me.MENU){if(me.MENU[j].url==dt[1].url){dt[1].title=me.MENU[j].title;}}
    }}
    if(me.SS.PATH.length==3){
      if(me.SS.PATH[2]!='' && me.SS.PATH[1]!='index.html'){
        dt[1]={}; dt[1].url='/'+me.SS.PATH[1]+'/index.html';
        for(j in me.MENU){if(me.MENU[j].url==dt[1].url){dt[1].title=mark+me.MENU[j].short;}}
        dt[2]={}; dt[2].url='/'+me.SS.PATH[1]+'/'+me.SS.PATH[2];
        for(j in me.MENU){if(me.MENU[j].url==dt[2].url){dt[2].title=mark+me.MENU[j].title;}}
      }else{
        dt[1]={}; dt[1].url='/'+me.SS.PATH[1]+'/index.html';
        for(j in me.MENU){if(me.MENU[j].url==dt[1].url){dt[1].title=mark+me.MENU[j].short;}}
        dt[2]={}; dt[2].url='/'+me.SS.PATH[1]+'/index.html';
        for(j in me.MENU){if(me.MENU[j].url==dt[2].url){dt[1].title=mark+me.MENU[j].title;}}
      }
    }
    var out=me.develop(base+'/template/'+mem+'.frm', dt);
    return out;

  },
//
// navbar ナビゲーションバーパーツ
//
  navbar: function(){
    var me=this;
    var out="", mem, base, dt, ix;

    base=me.INFOJ['base']; mem=me.INFOJ['navbar_form']||'menu1';    
    dt=me.selection("top");
    for(ix in dt){if(dt[ix].group==me.SS.PATH[1]){dt[ix].now='now';}else{dt[ix].now='';}}
    if(me.SS.PATH.length==2){dt[0].now='now';}

    var out=me.develop(base+'/template/'+mem+'.frm', dt);
    return out;
  },
//
// サイドメニューパーツ
//
  sidemenu: function(){
    var me=this; var out=""; var base=me.INFOJ['base'];
    var mem=me.INFOJ['sidemenu_form']||'menu2';
    var data=me.INFOJ['sidemenu_data']||'menu';
    var grp=me.INFOJ['Group'];
    
//    var dt=me.getJson(base+'/template/'+data+'.json');
    var dt=me.selection("side");
    var out=me.develop2(base+'/template/'+mem+'.frm', dt);
    
    return out;
  },
//var base=me.INFOJ['base'];
// foot フッタパーツ
//
  foot: function(){
    var me=this; var out=""; var base=me.INFOJ['base'];
    var mem=me.INFOJ['foot_form']||'footer1';
    var data=me.INFOJ['foot_data']||'menu';
    var grp=me.INFOJ['Group'];
    
 //   var dt=me.getJson(base+'/template/'+data+'.json');
    var dt=me.selection("top2");
    for(ix in dt){if(dt[ix].url==me.INFOJ.url){dt[ix].now='now'}else{dt[ix].now='';}}
    var out=me.develop2(base+'/template/'+mem+'.frm', dt, "top2");
    
    return out;
  },
//
// guide ページ内ガイドパーツ
//
  guide: function(){
    var me=this; var out=""; var base=me.INFOJ['base'];
    var mem=me.INFOJ['guide_form']||'menu3';
    var data=me.INFOJ['guide_data']||'menu';
    
//    var dt=me.getJson(base+'/template/'+data+'.json');
    var a=me.INFOJ['url'].split('#');
    var dt=me.selection("section", a[0]);
    var out=me.develop(base+'/template/'+mem+'.frm', dt);
    
    return out;
  },
//
// menu グループ内メニューパーツ
//
  menu: function(){
    var me=this; var out=""; var base=me.INFOJ['base'];
    var mem=me.INFOJ['navbar_form']||'menu4';
    var data=me.INFOJ['navbar_data']||'menu';
    
//    var dt=me.getJson(base+'/template/'+data+'.json');
    var dt=me.selection("sibling", me.INFOJ['Group']);
    var out=me.develop(base+'/template/'+mem+'.frm', dt);
    
    return out;
  },
//
// history 履歴を展開
//
  history: function(){
    var me=this;
    var data, fname, frame, dname, txt, base, ix, dt, jx, date;

    base=me.INFOJ['base'];
    frame=me.INFOJ['History_frame']||'history'; dname=me.INFOJ['History_source']||'history';
    if(me.CON.timesift){date=me.CON.today;}else{date=me.today('Y/M/D');}

    if(me.INFOJ.History=='auto'){dt=me.HISTORY;}
    else{
      try{
        dname=me.parm(base+'/json/'+dname+'.json'); dt=me.getJson(dname);
      }catch(e){
        txt='<p>NOT FOUND:'+dname+'</p>';
      }
    }
    data=[]; jx-=0; for(ix in dt){if(dt[ix].date){if(dt[ix].date<=date){data[ix]=dt[ix]; jx++;}}}
    if(!txt){txt=me.develop(base+'/template/'+frame+'.frm', data);}
    if(!txt){txt='<p>'+me.error+'</p>';}
    return txt;
  },
//
// develop2 ２段階展開パーツ
//
  develop2: function(fname, dt, tp, ix){
    var me=this; if(!dt){dt=me.REC;} if(!ix){ix=0;} tp=tp||"top2";
    var d=me.getText(fname, true);
    var f={}; f['-HEAD']=''; f['-BHEAD']=''; f['-BODY']=''; f['-BFOOT']=''; f['-FOOT']='';
    var k='-BODY'; var out='';
    if(d){
      if(d[0]){
        if(d[0].charCodeAt(0)==65279){d[0]=d[0].substr(1);} // bom除去feff
        if(d[0].charCodeAt(0)==65534){d[0]=d[0].substr(1);} // bom除去fffe
      }
      for(var i in d){switch(d[i]){
       case '-HEAD': k=d[i]; break; case '-BODY': k=d[i]; break; case '-FOOT': k=d[i]; break;
       case '-BHEAD': k=d[i]; break;case '-BFOOT': k=d[i]; break;
       default: f[k]+=d[i]+"\n";
      }}
    }else{return false;}
    out=me.parm(f['-HEAD'], dt[ix]);
    var url, a, l, y=-1;
    for(var i in dt){
      url=dt[i].url||""; a=url.split('/'); l=a.length;
      switch(tp){
        case "side": if(a[l-1].search(/#/)>0){l=l+1;} break;
        case "top2": if(a[l-1].search(/index.html/)<0){l=4;}else{l=3;} break;
      }
      switch(l){
       case 3:
        if(y>-1){out+=me.parm(f['-BFOOT'], dt[y]); y=-1;}
        out+=me.parm(f['-BHEAD'], dt[i]); y=i;
        break;
       case 4:
        out+=me.parm(f['-BODY'], dt[i]);
        break;
      }
    }
    if(y>-1){out+=me.parm(f['-BFOOT'], dt[y]); y=-1;}
    out+=me.parm(f['-FOOT'], dt[ix]);

    return out;
  },
//
// selection メニューデータ選択
//
  selection: function(type, grp, path){
    var me=this;
    var out={}, j=0, url, level, section, group;
    var f, a, b, l;
    if(path){l=path.length;}else{l=0;}

    for(i in me.MENU){
      f=false; url=me.MENU[i].url||""; level=me.MENU[i].level||-1; section=me.MENU[i].section||"";
      group=me.MENU[i].group||"";
      a=url.split('/'); b=url.split('#');
      switch(type){
       case "top": if(level<2 && section=="" && url.search(/index.html/)>0){f=true;}
        break;
       case "top2": if(level<2 && section==""){f=true;}
        break;
       case "2nd": if(a[1]==grp && level==1 && section==""){f=true;}
        break;
       case "sibling": if(group==grp && section==""){f=true;}
       break;
       case "side": if(a[1]==grp && level==1){f=true;}
        break;
       case "section": if(b[0]==grp && section!=""){f=true;}
        break;
       default: f=true;
      }
      if(f){out[j]=me.MENU[i]; j++;}
    }
    return out;
  },
//
// toolbox ツールボックスパーツ
//
  toolbox: function(){
    var me=this, dt, i;
    
    dt=me.selection('all');
    me.INFOJ['prevp']=""; me.INFOJ['nextp']=""; me.INFOJ['prevpa']=""; me.INFOJ['nextpa']="";
    var f=false; for(i in dt){
      dt[i].url=dt[i].url||'';
      if(f){me.INFOJ['nextp']=dt[i].url; me.INFOJ['nextpa']=dt[i].title;　break;}
      if(me.INFOJ.url==dt[i].url){f=true;}
      if(!f){me.INFOJ['prevp']=dt[i].url; me.INFOJ['prevpa']=dt[i].title;}
    }
  },
//
// color カラーサンプル
//
  color: function(){
    return CLR.colorSample();
  },
//
// menuBuild メニューのインコア
//
  menuBuild: function(op, force){
    var me=this; op=op||{}; force=force||false;
    var dt, fn, el, out, b, d, f, i, j, k, l, m, n, r, s, p, u, v, w, x, t;
    var base=op.base+'/'; var local=op.local+'/';

    if(force==false){if(me.CON['menuBuild']){
      if(me.CON['menuBuild']==me.today()){return;} if(me.CON.timesift){return;}
      me.infoLog('日付が変わりました。　New Date='+me.today());
    }}
    me.CON['menuBuild']=me.today();
    r=me.getFs(base+'index.cfg'); d=JSON.parse(r);
    var folders; for(j in d){
      f=true; if(d[j].CmsVersion){a=d[j].CmsVersion.split('/'); f=me.validation(a[1]);}
      if(f){if(d[j].Folders){folders=d[j].Folders;}}
    }
    if(folders){folders.unshift("");}else{folders=[];}    // トップを加える
    
    out=[]; his=[]; var cnt=0;
    for(i in folders){
      if(folders[i]==""){k="";}else{k=folders[i]+'/';}
      dt=me.dir(base+k, "file");
      for(j in dt){
        fn=base+k+dt[j];
        if(me.modifier(fn)=='page' && dt[j].substr(0, 5)!='error'){
          d=me.pageinfo(fn); if(!d["PARM"]){d['PARM']='Valid 99/12/31:00/01/01';}
          b=d["PARM"].split("\n");
          w={}; for(x in b){v=me.unstring(b[x]); w[v[0]]=v[1];}
          w.Title=w.Title||'no title';
          if(k==''){l=0;}else{l=1;}
          p=me.lastOf(dt[j], '.'); if(p>0){u='/'+k+dt[j].substr(0, p)+'.html';}else{u='/'+k+dt[j];}
          if(k==''){g='top';}else{g=folders[i];}
          if(w.Short){m=w.Short;}
          else{n=w.Title.search(/\(/); if(n<0){m=w.Title;}else{m=w.Title.substr(0, n);}}
          if(w.Valid){f=me.validation(w.Valid);}else{f=true;}
          if(f){
            t=me.stat(fn).mtime; t=t.substr(0, 2)+'-'+t.substr(2, 2)+'-'+t.substr(4, 2);
            out.push({
              "sort": w.Sort, "level": l, "section": "", "url": u,
              "title": w.Title, "short": m, "group": g, "date": t, "priority": w.Priority||0.5
            });
            cnt++;
          }else{
            me.infoLog('suppressed page:' + w.Title);            
          }

          b=d["HISTORY"].split("\n");
          for(x in b){
            v=me.unstring(b[x]);
            f=me.repby(me.filepart(dt[j]), '.page', '.html');
            if(v[0]){
              his.push({"date": v[0], "title": v[1], "url": u});
            }
          }
        }
      }
    }
    me.MENU=me.sort(out);
    me.HISTORY=me.sort(his, 'date', 'des');
//    var fd=Fs.openSync(local+'menu.json', "w");
//    Fs.writeSync(fd, JSON.stringify(me.MENU), 0, 'utf8', function(){});
//    Fs.closeSync(fd);
    me.infoLog('メニュー更新しました。cnt=' + cnt);

  },
//
// サイトマップxml作成
//
  sitemap: function(res){
    var me=this; var out, ix, prty; out='';

    out+='<?xml version="1.0" encoding="UTF-8"?>';
    out+='<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    for(ix in me.MENU){
      prty=me.MENU[ix].priority||0.5;
      out+='<url>';
      out+='<loc>http://www.kmrweb.net'+me.MENU[ix].url+'</loc>';
      out+='<lastmod>20'+me.MENU[ix].date+'</lastmod>';
      out+='<changefreq>always</changefreq>';
      out+='<priority>'+prty+'</priority>';
      out+='</url>';
    }
    out+='</urlset>';
    res.writeHead(200, {
      "Content-Type": "text/xml", "charset": "utf-8"
    });
    res.end(out);
  },
//
// sort メニューデータソート機能
//
  sort: function(dt, key, asc){
    var i, j, house, f, t; key=key||'sort'; asc=asc||'asc';
    for(i=0; i<dt.length-1; i++){
      for(j=i+1; j<dt.length; j++){
        f=dt[i][key]||""; t=dt[j][key]||"";
        if(asc=='asc'){
          if(t<f){house=dt[j]; dt[j]=dt[i]; dt[i]=house;}
        }else{
          if(t>f){house=dt[j]; dt[j]=dt[i]; dt[i]=house;}
        }
      }
    }
    return dt;
  },
//
// validation 有効期間の判定
//
  validation: function(term){
    var me=this; var a;
    
    if(!term){return true;}
    a=term.split(':');
    if(!a[0]){a[0]='00/01/01';} if(!a[1]){a[1]='99/12/31';}
    if(a[0]<'00/01/01'){return false;} if(a[0]>'99/12/31'){return false;}
    if(a[1]<'00/01/01'){return false;} if(a[1]>'99/12/31'){return false;}
    if(me.CON.timesift){
      if(a[0]>me.CON.today){return false;}
      if(a[1]<me.CON.today){return false;}
    }else{
      if(a[0]>me.today('Y/M/D')){return false;}
      if(a[1]<me.today('Y/M/D')){return false;}
    }
    return true;

  },
//
//
//
  cleanup: function(op){
    var me=this; op=op||{}; if(op.keepDays==undefined){op.keepDays=3;}
    var l, c, i, f, s, d, ca=0, cd=0;
    l=me.dir(op.data);
    c=me.addDays(op.keepDays*-1);
    for(i in l){
      ca++;
      f=op.data+'/'+l[i]; s=me.stat(f); d=s.atime.substr(0, 6);
      if(d<c){Fs.unlink(f); cd++;}
    }
    me.infoLog('全件数:'+ca);
    me.infoLog('削除件数:'+cd);
  },
//
  closeCms: function(){}
});
module.exports=Kc;
