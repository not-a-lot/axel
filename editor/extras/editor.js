/* Copyright (c) 2012 S. Sire
 *
 * author      : Stéphane Sire
 * contact     : s.sire@oppidoc.fr
 * last change : 2012-09-05
 *                         
 * AXEL demo editor
 */

// A few constants
var _INPUT_FILE = 'extras/input.html';
var _INTRO_FILE = 'extras/intro.xhtml';

/**
 * Utility Methods
 */

var Utility = {
  
  // Class 
  FileListAction : function () {
      this.status = 0;
      this.error = 'uncalled';
      this.list = null;
  },

  // Returns true if the running application has been started directly from the file system
  isLocalSession : function () {
    return (0 === document.location.href.indexOf('file://'));
  },
  
  // Returns fn if the application hasn't been launched from a file:// URL
  // Returns a URL obtained by appending the path component of the file:// URL to fn otherwise
  getAbsoluteFilePath : function (fn) {
    if (fn.charAt(0) != '/') { // not an absolute path (except on Windows...)
      var localPath = document.location.href.match(/file:\/\/(\/.*)\/[^\/]*/); 
      if (localPath) {
        return (localPath[1] + '/' + fn);
      }
    }
    return fn;
  },
      
  // Turns url into a effective url that can be used to load a resource file. 
  // Simply escapes url characters if the caller has been started from a local file, otherwise 
  // appends the proxy string so that the url is accessed through a proxy.
  makeURLForFile : function (url, proxy) {
    if ((Utility.isLocalSession()) || (url.indexOf('file://') == 0) || (url.indexOf('http://') == -1)) {
      return url;
    } else {
      return proxy + escape(url);
    }
  }
};

Utility.FileListAction.prototype = {
  // Pre-defined data detectors and data filters to parse, extract and select which file names to return
  // Note that these are static methods because of the way they are called in "load"
  _localDirRegExp : new RegExp("\\s?([^\\s]*)\\s0.*DIRECTORY", "mgi"),  // regexp to match folder names 
  _localxTigerTmplRegExp : new RegExp("\\s?([^\\s]*\\.(xtd|xhtml))", "mgi"),
  _proxyDirRegExp : new RegExp('href\s?=[\'\"]([^\/]*)\/[\'\"]', "mgi"),  // regexp to match folder names 
  _proxyxTigerTmplRegExp : new RegExp('href\s?=[\'\"](.*\.xtd)[\'\"]', "mgi"),
  
  localSubFolderDetector : function () {
    return Utility.FileListAction.prototype._localDirRegExp;    
  },
  localxTigerTmplDetector : function () {
    return Utility.FileListAction.prototype._localxTigerTmplRegExp;  // regexp to match file names    
  },
  proxySubFolderDetector : function () {
    return Utility.FileListAction.prototype._proxyDirRegExp;    
  },
  proxyxTigerTmplDetector : function () {
    return Utility.FileListAction.prototype._proxyxTigerTmplRegExp;  // regexp to match file names    
  },
  subFolderFilter : function (name) {
    return (name.length > 0) && (name.charAt(0) != '.'); // remove "hidden" folders such as ".svn" and "/"
  },
  xTigerTmplFilter : function (name) {
    return true;
  },

  // Core functions
  isInError : function () {
    return this.status != 1;    
  },
  isEmpty : function () {
    return this.isInError() || (this.list.length == 0);
  },
  getFiles : function () { 
    return this.list;
  },
  
  //FIXME: maybe we should Use WebDAV search method on IE if started locally (file URL ?)
  load : function (url, detector, filter) {
    var xhr = xtiger.cross.getXHRObject ();
      var listing;
    var src = url;
    try {
        xhr.open( "GET", url,  false); 
        // false:synchronous thus we don't need to define xhr.onreadystatechange 
        // see http://developer.mozilla.org/en/XMLHttpRequest
        xhr.send(null);
          if((xhr.status  == 200) || (xhr.status  == 0)) { // second test is for local usage -no Web server (from XHR MozDev doc)
        listing = xhr.responseText;
        this.status = 1;
        } else { 
            this.error = "Impossible to open folder : '" + src + "'. Error : " + xhr.status;
        this.status = 0;
      }
    } catch (e) {
      xhr.abort();
      this.error = "Impossible to open folder : '" + url + "'. " + e.name + ' : ' + e.message;
      this.status = 0;
    }
    if (0 != this.status ) { // Parses result to extract file names
      this.list = new Array();
      var rext = detector();
      var m;
      while (null != (m = rext.exec(listing))) {
        if (filter(m[1]))
          this.list.push(m[1]);
      }
    }
  },
  loadSubFoldersFrom : function (url) { 
    if (Utility.isLocalSession()) {
      this.load(url, this.localSubFolderDetector, this.subFolderFilter);
    } else {
      this.load(url, this.proxySubFolderDetector, this.subFolderFilter);
    }
  },
  loadxTigerTmplFrom : function (url) { 
    if (Utility.isLocalSession()) {   
      this.load(url, this.localxTigerTmplDetector, this.xTigerTmplFilter);
    } else {
      this.load(url, this.proxyxTigerTmplDetector, this.xTigerTmplFilter);
    }
  }
};

/**
 * A window for logging data
 * An alternative design could be to make it directly a DOMLogger (?)
 */
xtiger.util.LogWin = function (name, width, height, isTranscoding) {
  var params = "width=" + width + ",height=" + height + ",status=yes,resizable=yes,scrollbars=yes,title=" + name;
  if (xtiger.cross.UA.IE) {
    this.window = window.open('about:blank');
  } else {
    this.window = window.open(null, name, params);    
  }
  this.doc = this.window.document;
  this.doc.open();
  this.isTranscoding = isTranscoding;
}

xtiger.util.LogWin.prototype = {       
  
  // Dumps a form inside this LogWin
  // Assumes form has been configured to dump schemas
  dumpSchema : function (form, stylesheet, template) {
    var dump = new xtiger.util.SchemaLogger ();   
    var data = form.serializeData (dump);
    this.write(dump.dump('*'));
    this.close();     
  },    
  // Dumps a form inside this LogWin
  // stylesheet is an optional stylesheet filename, if present it adds a stylesheet processing instruction
  // filename is the optional name of the XML content file, if present it is added as a 'filename' attribute
  //  on the root node
  dump : function (form, stylesheet, template) {
    var buffer;
    var dump = new xtiger.util.DOMLogger ();
    // form.setSerializer(new xtiger.editor.BasicSerializer ());
    var data = form.serializeData (dump);
    buffer = "<?xml version=\"1.0\"?>\n" // encoding="UTF-8" ?
    if (stylesheet) {
      buffer += '<?xml-stylesheet type="text/xml" href="' + stylesheet + '"?>\n';
    }
    if (template) {
      buffer += '<?xtiger template="' + template + '" version="1.0" ?>\n';
    }                                           
    buffer += dump.dump('*');
    this.write(buffer);
    this.close();     
  },
  transcode : function (text) {
    var filter1 = text.replace(/</g, '&lt;');
    var filter2 = filter1.replace(/\n/g, '<br/>');    
    var filter3 = filter2.replace(/ /g, '&nbsp;');    
    return filter3;
  },
  write : function (text) {     
    var t = this.isTranscoding ? this.transcode(text) : text;
    this.doc.writeln(t);
  },
  
  close : function (text) {
    this.doc.close();
  },  
  dispose : function () {
    this.doc.close(); 
  } 
};

/*****************************************************/
/*                                                   */
/*            Application Controller                 */
/*                                                   */
/*****************************************************/   

// Returns the path to the current page (which should be 'editor.xhtml') concatenatd with url
function xttMakeLocalURLFor (url){   
  var m = document.location.href.match(/^(.*)\/\w+.xhtml$/);
  if (m){
    return m[1] + '/' + url;
  }             
  return url; 
}

// Relay function - called from within the _INPUT_FILE document which is loaded in a popup window
function handleInstanceData (data) {
  appController.handleInstanceData (data);  
}           

// Trick to avoid that dropping something in the editor's window replaces the document
// This is useful to avoid unwanted drops when the template contains some drop targets
function cancelDropCb (ev) {
  ev.preventDefault();
}
function dragEnterCb (ev) {
  ev.preventDefault();
}
function dragOverCb (ev) {
  ev.preventDefault();
}

function viewerApp (path, tplModel) {
    var std, path;
    this.templatePath = null; // path to the current templates folder
    this.templateList = null; // list of current template files in current templates folder
    this.menuModel = tplModel; // data model for templates folders / files
    this._createFoldersMenu();
    this.installTemplateMenu(0); // displays current folder and template menu
    if (localStorage) { // restore preferences
      path = localStorage.getItem('templatesPath');
      if (path) {
        this.setCustomTemplatesFolder(path);
      }
    }
    this.curTransfo = null;
    this.curBody = null;
    this.inputPopupWindow = null;    
    this.baseUrl = '../bundles';
    this.xtStylesheet = '../axel/axel.css';
    this.previewMode = 0; // Pushing preview will add 'preview' to wrapper class
    
    // XML loading algorithms (selection by radio button in prefs pane)
    // names MUST match radio button values in UI !
    this.loaders = {
      'standard' : xtiger.editor.BasicLoader ? new xtiger.editor.BasicLoader() : undefined,
      'html' : xtiger.editor.HTMLLoader ? new xtiger.editor.HTMLLoader() : undefined,
      'robust' : xtiger.editor.RobustLoader ? new xtiger.editor.RobustLoader() : undefined
    };
    
    // XML serialization algorithms (selection by radio button in prefs pane)
    std = xtiger.editor.BasicSerializer ? new xtiger.editor.BasicSerializer () : undefined;
    this.serializers = {
      'standard' : std,
      'html' : xtiger.editor.HTMLSerializer ? new xtiger.editor.HTMLSerializer() : undefined,
      'robust' : std,                                           
      'schema' : xtiger.editor.SchemaSerializer ? new xtiger.editor.SchemaSerializer() : undefined
    };
    
    // Event Handler used to monitor when the iframe has been loaded with a template
    var _this = this;
    this.frameLoadedHandler = function () { _this.frameLoaded() };
}

viewerApp.prototype = {
  
  PROXY : "../proxy/myContentProxy.php?target=",   // FIXME : move proxy to scripts/server/server.rb
  STORE_URL : 'http://localhost:8042/store?file=', // to be used with scripts/server/server.rb
  DUMP_URL : 'http://localhost:8042/dump?file=', // to be used with scripts/server/server.rb
  
  // Non-functional: Safari, Opera, Chrome do not show the object URL in iframe,
  // Firefox shows it but it does not dereference embedded scripts / CSS files
  handleFiles : function (files) {
    alert('HandleFiles');
    var fileObj = files[0];
    var objUrl = window.URL.createObjectURL(fileObj);
                // window.webkitURL.createObjectURL();
    var iframe = document.getElementById('container');
    xtdom.addEventListener(iframe, 'load', this.frameLoadedHandler, false);
    iframe.src = objUrl;
  },
  
  setBase : function (url) {
    this.baseUrl = url;
  },

  setXTigerStylesheet : function (filePath) {
    this.xtStylesheet = filePath;
  },

  /*****************************************************/
  /*                                                   */
  /*            Primary Event Handlers                 */
  /*                                                   */
  /*****************************************************/ 

  resetView : function () {
    var container = document.getElementById('container');
    if (container) { // called from 'editor.xhtml'
      container.setAttribute('src', _INTRO_FILE);
    } // else called from 'editornoframe.xhtml'
    document.getElementById('titleUrl').firstChild.nodeValue = '...';     
  },

  setPreferences : function () {
    var n = document.getElementById('prefs');
    if (n.value === 'Preferences') {
      n.value = 'Hide'; // toggle state
      n = document.getElementById('templateRepos');
      n.value = this.templatePath;
      var lowerdiv = document.getElementById('frameContainer');
      if (lowerdiv) { // called from 'editor.xhtml'
        lowerdiv.style.top = "15em";  
      } else { // called from 'editornoframe.xhtml'
        var prefs = document.getElementById('preferences');
        prefs.style['display'] = 'block';     
      }
    } else {
      n.value = 'Preferences'; // toggle state
      this.hidePreferences();
    }
  },

  hidePreferences : function () {
    var lowerdiv = document.getElementById('frameContainer');
    if (lowerdiv) { // called from 'editor.xhtml'
      lowerdiv.style.top = "8em"; 
    } else { // called from 'editornoframe.xhtml'
      var prefs = document.getElementById('preferences');
      prefs.style['display'] = 'none';      
    }
  },

  savePreferences : function () {
    var n = document.getElementById('templateRepos');
    var path = n.value;
    this.setCustomTemplatesFolder(path);
  },
  
  // Changes the templatesList menu to reflect the new foldersList menu selection
  updateSelectedFolder : function () {
    var i = this.getFirstSelectedIndexFromSelect(document.getElementById('foldersList'));
    this.installTemplateMenu(i);
  },
    
  // Changes the current template URL displayed in the formUrl field
  // to reflect the new template selection in templatesList
  updateSelectedTemplate : function () {
    var i = this.getFirstSelectedIndexFromSelect(document.getElementById('templatesList')),
        e = document.getElementById('formUrl');
    e.url.value = (i === 0) ? '' : this.templatePath + this.templateList[i];
  },
  
  doToggleViewMode : function () {
    var n = document.getElementById('previewToggle');
    var iframe = document.getElementById('container');                  
    var iframeDoc;
    if (iframe.contentDocument) {
      iframeDoc = iframe.contentDocument;
    } else if (iframe.contentWindow) {  // IE7
      iframeDoc = iframe.contentWindow.document;      
    }       
    var body = iframeDoc.getElementsByTagName('body')[0]; 
    if (this.previewMode == 0) {
      xtdom.addClassName (body, 'preview');
      xtdom.setAttribute(n, 'value', 'Edit'); 
      this.previewMode = 1;
    } else {
      xtdom.removeClassName (body, 'preview')
      xtdom.setAttribute(n, 'value', 'Preview'); 
      this.previewMode = 0;
    }
  },

  /////////////////////////////////////////////
  // Template tranformation to an editor
  /////////////////////////////////////////////    
  
  // Loads the template into an XML document (synchronously), copies its body into the target container in the principal window
  // and then transform it 
  submitPageNoFrame : function () {
    var e = document.getElementById('formUrl');
    var s = e.url.value;     
    if (s.search(/\S/) != -1) {
      var url = Utility.makeURLForFile(s, this.PROXY);
      var result = new xtiger.util.Logger();
      var xtDoc = xtiger.debug.loadDocument(url, result);
      if (xtDoc) {
        this.curForm = new xtiger.util.Form (xttMakeLocalURLFor(this.baseUrl));
        this.curForm.setTemplateSource (xtDoc); 
        this.curForm.setTargetDocument (document, 'containerNoFrame', true)
        this.curForm.enableTabGroupNavigation (); 
        this.curForm.transform (result);
      }
      if (result.inError()) { this.log(result.printErrors(), 1); }
    }
    return false; // prevent default action
  },  
  
  // Loads the template into the iframe and wait on load to call frameLoaded
  submitPage : function () {
    var e = document.getElementById('formUrl');
    var s = e.url.value;
    if (! s.match(/^\s*$/)) {
      var url = Utility.makeURLForFile(s, this.PROXY);
      var iframe = document.getElementById('container');
      xtdom.addEventListener(iframe, 'load', this.frameLoadedHandler, false);
      iframe.src = url;
    }
    return false; // prevent default action
  },
  
  // Creates the XTiger form UI on top of the document just loaded into the frame
  frameLoaded : function () {
    var iframeDoc, e,
        iframe = document.getElementById('container'),
        errLog = new xtiger.util.Logger();
    xtdom.removeEventListener(iframe, 'load', this.frameLoadedHandler, false);
    if (iframe.contentDocument) {
      iframeDoc = iframe.contentDocument;
    } else if (iframe.contentWindow) { // IE7
      iframeDoc = iframe.contentWindow.document;      
    } 
    if (window.frames[0].$axel) { // template already uses AXEL
      this.curForm = xtiger.session(iframeDoc).load('form');
      // see form.js currrently only one form per document
      if (this.curForm) {
        this.log('Self-transformed template detected : the editor has managed to plug on its AXEL object', 0);
      } else {
        this.log('Self-transformed template detected : the editor has failed to plug on its AXEL object', 1);
      }
    } else {
      this.curForm = new xtiger.util.Form (xttMakeLocalURLFor(this.baseUrl));
      if (this.curForm.setTemplateSource (iframeDoc, errLog)) {
        this.curForm.enableTabGroupNavigation ();
        e = document.getElementById('formUrl');
        if (e.profile.checked) {
          console.profile();
        }
        if (! this.curForm.transform(errLog)) {
          this.log('Transformation failed', 1);
        } else {
          this.log('Transformation success', 0);
          if (window.jQuery) {
            // triggers completion event on main document
            $(document).triggerHandler('axel-editor-ready', [this]);
          }
        }
        if (e.profile.checked) {
          console.profileEnd();
        }
        if (! errLog.inError()) { // injects axel.css in iframe
          this.curForm.injectStyleSheet(xttMakeLocalURLFor(this.xtStylesheet), errLog);
        }
      }
      if (errLog.inError()) { // summarizes errors
        alert(errLog.printErrors());
      }
      $('body', iframeDoc).bind('dragenter', dragEnterCb);
      $('body', iframeDoc).bind('dragover', dragOverCb);
      $('body', iframeDoc).bind('drop', cancelDropCb);
    }
  }, 
  
  /////////////////////////////////////////////
  // Template dump (window, file or server)
  ///////////////////////////////////////////// 

  // Dumps the schema for the currently opened template document in a new window
  dumpSchema : function () {  
    if (this.checkTemplate ()) {
      var log = new xtiger.util.LogWin ("Template Schema", 400, 600, true); 
      if (this.serializers['schema']) {
        this.curForm.setSerializer(this.serializers['schema']);
        log.dumpSchema(this.curForm);
      } else {
        alert('Missing "schema" serializer algorithm, check required source file is included !');
      }
    }
  },  
  
  // Dumps the currently opened template document in a new window
  dump : function () {  
    var log,
      algo = this.getPreferredAlgo('save');     
    if (algo && this.checkTemplate ()) {                                           
      log = new xtiger.util.LogWin ("XML instance data", 400, 600, (algo != 'html'));
      this.curForm.setSerializer(this.serializers[algo]);
      log.dump(this.curForm);
    }
  },                
         
  // Saves the file to an absolute path "path" on the local disk (FF only)
  // The path must contain the file name, "name" is just here for feedback messages
  _saveToDisk : function (path, name) {     
    var startt = new Date();    
    if (this.curForm.saveDataToFile (path)) { 
      var endt = new Date();                     
      var duration = endt.getTime() - startt.getTime();
      this.log('File "' + name + '" saved in ' + duration + 'ms', 0);
    } else {
      this.log(this.curForm.msg, 1);
    }
  },
  
  // Saves to local disk using a local file selection dialog box (FF only)
  localSaveInstanceData : function (inputName) {
    if (this.checkFireFox() && this.checkTemplate()) {
      var filePath = xtiger.util.fileDialog('save', "*.xml; *.xhtml; *.html", "Select a file to save XML data");              
      if (filePath) { 
        var name = filePath.match(/[^\/]*\.(xml|xhtml|html)$/)[0];
        this.chooseSerializer();        
        this._saveToDisk(filePath, name);
        var e = document.getElementById('formUrl');
        e[inputName].value = filePath;
      }
    }
  },  

  saveToFile : function  () {
    var n, fn, url, result, sos, algo;        
    if (this.checkTemplate ()) {    
      n = document.getElementById('fileName');
      fn = n.value;
      if (fn.search(/\S/) != -1) { // not empty string
        url = Utility.isLocalSession() ? Utility.getAbsoluteFilePath(fn) : this.STORE_URL + fn;
        if (confirm('Are your sure you want to save current data to "' + fn + '" ?')) {
          result = new xtiger.util.Logger();                                            
          this.chooseSerializer();
          if (xtiger.cross.UA.gecko && Utility.isLocalSession()) { // Uses FF local save
            this._saveToDisk(url, fn);
          } else {
            if (this.curForm.postDataToUrl(url, xtiger.cross.getXHRObject())) { 
              this.log('Data saved : ' + this.curForm.msg, 0);
            } else {
              if (Utility.isLocalSession()) {
                sos = "Data save failed most probably because POST is not support by your browser when writing to the local file system";
                this.log(sos, 1);
              } else {
                this.log(this.curForm.msg, 1);                
              }
            }
          }
        }
      }
    }
  },
  
  // Sends current template content to a Web server with a POST message 
  // FIXME: currently not implemented in scripts/server/server.rb
  dumpToServer : function () {
    var url;
    if (this.checkTemplate ()) {
      url = this.DUMP_URL;
      this.chooseSerializer();
      if (this.curForm.postDataToUrl(url, xtiger.cross.getXHRObject())) { 
        this.log('Data dumped : ' + this.curForm.msg, 0);
      } else {
        this.log(this.curForm.msg, 1);
      }
    }
  },  
  
  /////////////////////////////////////////////
  // Template load (from window or file)
  /////////////////////////////////////////////
  
  _loadFromUrl : function (url, name) {
    var startt = new Date();
      var e = document.getElementById('formUrl');
    if (e.profile && e.profile.checked) { console.profile(); }
    var result = new xtiger.util.Logger();
    var data = xtiger.debug.loadDocument(url, result);
    if (data) {
      var dataSrc = new xtiger.util.DOMDataSource(data);
      var loader = this.getPreferredLoader();
      if (! loader)   return;     
      this.curForm.setLoader(loader);
      if (this.curForm.loadData(dataSrc, result)) {
        var endt = new Date();                     
        var duration = endt.getTime() - startt.getTime();
        this.log( 'File "' + name + '" loaded in ' + duration + 'ms');
      }
    }
    if (result.inError()) { this.log(result.printErrors(), 1); }
    if (e.profile && e.profile.checked) { console.profileEnd(); }
  },    

  loadFromFile : function () {  
    if (this.checkTemplate()) {
      var n = document.getElementById('fileName');
      var fn = n.value;
      if (! fn.match(/^\s*$/)) {
        var url = Utility.isLocalSession() ? Utility.getAbsoluteFilePath(fn) : this.STORE_URL + fn;
        this._loadFromUrl(url, fn);
      }
    }
  },
  
  // Displays an input popup window and wait for inputWindowLoaded
  inputInstanceData : function () {
    var params = "width=600,height=400,status=yes,resizable=yes,scrollbars=yes";
    if (xtiger.cross.UA.IE) {
      this.inputPopupWindow = window.open(_INPUT_FILE);
    } else {
      this.inputPopupWindow = window.open(_INPUT_FILE, "Instance Data Input", params);
      this.inputPopupWindow.focus ();
    }
  },

  // Called when the user's has entered data in the input popup window and has clicked on load
  handleInstanceData : function (data) {    
    if (this.checkTemplate()) {                       
      var loader = this.getPreferredLoader();
      if (! loader) return;     
      this.curForm.setLoader(loader);
      if (! this.curForm.loadDataFromString(data)) {
        this.log (this.curForm.msg, 1);
      }
    } 
  },        
  
  // Opens a local file dialog to select a file (FF only)
  // Returns the selected file path in inputName form field
  localFileDialog : function (mode, filter, msg, inputName) {
    if (this.checkFireFox()) {
      var filePath = xtiger.util.fileDialog(mode, filter, msg);
      if (filePath) {            
        var e = document.getElementById('formUrl');
          e[inputName].value = filePath;
      }
    }
  },
  
  // Loads from local disk using a local file selection dialog box (FF only)
  localLoadInstanceData : function (inputName) {
    if (this.checkFireFox() && this.checkTemplate()) {
      var filePath = xtiger.util.fileDialog('open', "*.xml; *.xhtml; *.html", "Select a file to load XML data");
      if (filePath) {            
        var name = filePath.match(/[^\/]*\.(xml|xhtml|html)$/)[0];
        this._loadFromUrl(filePath, name);
        var e = document.getElementById('formUrl');
        e[inputName].value = filePath;
      }
    }
  },    
        
  /*****************************************************/
  /*                                                   */
  /*            Utilities                              */
  /*                                                   */
  /*****************************************************/    
  
  getPreferredAlgo : function (action) {
    var e = document.getElementById('formUrl'),
    algo = e.algorithm,
    i = algo.length - 1;
    while ((i >= 0) && (! algo[i].checked)) {
      i -= 1;
    } // note 0 is standard algorithm
    // sanity check
    if (action == 'load') {
      if (this.loaders[algo[i].value] === undefined) {
        alert('Missing "' + algo[i].value + '" loader algorithm, check required source file is included !');
        return;
      }
    } else if (action == 'save') {
      if (this.serializers[algo[i].value] === undefined) {
        alert('Missing "' + algo[i].value + '" serializer algorithm, check required source file is included !');
        return;
      }
    }
    return algo[i].value;
  },  

  getPreferredLoader : function () {
    var e = document.getElementById('formUrl'),
    algo = this.getPreferredAlgo('load');
    if (algo) {
      xtiger.cross.log('debug', 'Using loader algorithm ' + algo);
      return this.loaders[algo];
    }
  },        

  // Configures the form object to use preferred serialization algo
  chooseSerializer : function () {
    var algo = this.getPreferredAlgo('save');
    if (algo) {
      this.curForm.setSerializer(this.serializers[algo]);  
      xtiger.cross.log('debug', 'Using serializer algorithm ' + algo);    
    }
  },
  
  checkFireFox : function () {
    if (! xtiger.cross.UA.gecko) {
      alert('This option is only available on Firefox');
      return false;
    } 
    return true;
  },

  checkTemplate : function () {
    if (! this.curForm) { 
      alert('You must open a template first !');    
      return false;
    } 
    return true;
  },  

  log : function (msg, level) {
    var display = document.getElementById('titleUrl');
    display.firstChild.nodeValue = msg;
    if (1 == level) 
      display.setAttribute('style','color: red');
    else 
      display.setAttribute('style','');
  },  
  
  getFirstSelectedIndexFromSelect : function (sel) {
    for (var i = 0; i < sel.options.length; i++) {
            if (sel.options[i].selected) {
        break;
        }
    }
    return i;
  },       
  
  /*****************************************************/
  /*                                                   */
  /*            Initializations                        */
  /*                                                   */
  /*****************************************************/
  
  _createFoldersMenu : function () {
    var i, o, s, n = document.getElementById('foldersList');
    xtdom.removeChildrenOf(n);
    for (i = 0; i < this.menuModel.length; i++) {
      o = xtdom.createElement(document, 'option');
      key = xtdom.createTextNode(document, this.menuModel[i].name);
      o.appendChild(key);
      n.appendChild(o);
    }
  },
  
  _initTemplatesMenu : function (list) {
    var o, t, n = document.getElementById('templatesList');
    xtdom.removeChildrenOf(n);
    if (list[0] != '---') {
      list.splice(0, 0, '---');
    }
    for (var i = 0; i < list.length; i++) {
      o = xtdom.createElement(document, 'option');
      t = xtdom.createTextNode(document, list[i]);
      o.appendChild(t);
      n.appendChild(o);
    }
  },
  
  // Change the custom template folder
  setCustomTemplatesFolder : function (path) {
    var i, o, t, n, path2folder = path;
    if (path && path.length > 0) {
      if ((path.length > 0) && (path.charAt(path.length -1) != '/')) {
        path2folder +=  '/'; // adds trailing '/'
      }
      this.log("Setting custom templates folder path to " + path2folder);
      n = document.getElementById('foldersList');
      if (! this.modelCustomIndex) { // create the entry
        this.modelCustomIndex = this.menuModel.length;
        this.menuModel.push({
          name : '_custom_',
        });
        o = xtdom.createElement(document, 'option');
        s = xtdom.createTextNode(document, '#yours#');
        o.appendChild(s);
        n.appendChild(o);
      }
      for (var i = 0; i < (n.options.length - 1); i++) {
        n.options[i].selected = false;
      }
      n.options[this.modelCustomIndex].selected = true;
      this.menuModel[this.modelCustomIndex].path = path2folder;
      this.menuModel[this.modelCustomIndex].files = [];
      this.menuModel[this.modelCustomIndex].loaded = false;
      this.installTemplateMenu(this.modelCustomIndex);
      if (localStorage) {
        localStorage.setItem('templatesPath', path2folder);
      }
    } else {
      this.log("You must enter a non empty path", 1);
    }
  },  
  
  // Select folder at index
  // Sets this.templatePath and this.templateList
  // If first view of folder then try to initialize its content from file system
  installTemplateMenu : function (index) {
    var list, model = this.menuModel[index];
    if (! model.loaded) { // try reading templates list from file system (browser dependent)
      list = new Utility.FileListAction ();
      list.loadxTigerTmplFrom(Utility.makeURLForFile(model.path, this.PROXY));
      if (list.isInError()) { // in error, leave template list to default
        this.log(list.error, 1);
      } else if (list.isEmpty()) { // empty, leave template list to default
        this.log("Template files list from '" + model.path + "', is empty, menu set to defaults", 0);
      } else { // sucess
        model.files = list.getFiles(); // overrides defaults
      }
      model.loaded = true;
    }
    this._initTemplatesMenu(model.files);
    this.templatePath = model.path;
    this.templateList = model.files;
  }
}