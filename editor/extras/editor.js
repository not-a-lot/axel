/* Copyright (c) 2012 S. Sire
 *
 * author      : Stéphane Sire
 * contact     : s.sire@oppidoc.fr
 * last change : 2012-09-05
 *
 * AXEL demo editor
 */


(function () {
   var appController;

   function updateTransform () {
     if ($.trim($('#url').val()).length > 0) {
       $('#transform').removeAttr('disabled');
     } else {
       $('#transform').attr('disabled', 'disabled');
     }
   }

   function initApp () {
     var tmp, defaultTemplates = window.getDefaultTemplates ? getDefaultTemplates() : {};

     // Application controller
     appController = new viewerApp("../templates/", defaultTemplates);
     appController.setBase('../axel/bundles');
     appController.setXTigerStylesheet('../axel/axel.css');

     // Disable UI controls depending on available editor
     $('input.editing').attr('disabled', 'disabled');
     if (! $.browser.mozilla) {
       $('input.mozilla').hide();
     }
     tmp = $.trim($('#url').val());
     if (tmp && (tmp.length === 0)) {
       $('#transform').attr('disabled', 'disabled');
     }

     // Event handlers
     $('#formUrl').bind('submit', function() { return appController.submitPage(); });
     $('#url').bind('change blur', function() { updateTransform(); });
     $('#resetEditor').bind('click', function () { appController.resetView(); });
     $('#browseTemplate').bind('click', function () { appController.localFileDialog("open", "*.xtd; *.xhtml; *.html; *.xml", "Select an XTiger Forms template", "url"); });
     $('#foldersList').bind('change', function () { appController.updateSelectedFolder(); });
     $('#templatesList').bind('change', function () { appController.updateSelectedTemplate(); });
     $('#sourceTemplate').bind('click', function (event) { appController.viewTemplateSource(event); });
     $('#dumpSchema').bind('click', function () { appController.dumpSchema(); });
     $('#previewToggle').bind('click', function () { appController.doToggleViewMode(); });
     $('#dump').bind('click', function () { appController.dump(); });
     $('#download').bind('click', function () { appController.localDownloadInstanceData(); });
     $('#directInput').bind('click', function () { appController.inputInstanceData(); });
     $('#load').bind('click', function () { appController.localLoadInstanceData('fileName'); });
     $('#new').bind('click', function () { appController.newDocument(); });
     $('#browseTemplateFolder').bind('click', function () { appController.localFileDialog("folder", null, "Select a folder that contains some XTiger Forms templates", "templateRepos"); });
     $('#setTemplateFolder').bind('click', function () { appController.savePreferences(); });
     $('#saveToFile').bind('click', function () { appController.saveToFile(); });
     $('#loadFromFile').bind('click', function () { appController.loadFromFile(); });
     $('#prefs').bind('click', function () { appController.setPreferences(); });

     // HTML5 optional features
     if (typeof window.FileReader === "undefined") { // load
       $('#load').hide();
     }
     if ((typeof window.webkitURL === "undefined")) { // save
       $('#download').hide();
     }
     $('#fileToLoad').bind('change', function (ev) { appController.localFileSelected(ev); }); // HTML5 file loading

     // Hash shortcut to automagically a preselection
     appController.loadFromHash();
     $(window).on('hashchange', function() { appController.loadFromHash() });

     window.AXEL_editor_handleInstanceData = handleInstanceData; // export for access from popup window
     window.AXEL_editor_retrieveInstanceData = retrieveInstanceData; // export for access from popup window
     window.AXEL_editor_storeInstanceData = storeInstanceData; // export for access from popup window
    }

  // A few constants
  var _INPUT_FILE = 'extras/input.html';
  var _DUMP_FILE = 'extras/dump.html';
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
            this.error = "Could not read folder : '" + src + "' content (" + xhr.status + "), menu content has been filled with defaults.";
            this.status = 0;
          }
      } catch (e) {
        xhr.abort();
        this.error = "Could not read folder : '" + url + "' (" + e.name + ' : ' + e.message + "), menu content has been filled with defaults.";
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
    },
    // Dumps a form inside this LogWin
    // stylesheet is an optional stylesheet filename, if present it adds a stylesheet processing instruction
    // filename is the optional name of the XML content file, if present it is added as a 'filename' attribute
    //  on the root node
    dump : function (form, stylesheet, template) {
      var buffer;
      var dump = new xtiger.util.DOMLogger ();
      form.serializeData (dump);
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
    var m = document.location.href.match(/^(.*)\/\w+.xhtml/);
    if (m){
      return m[1] + '/' + url;
    }
    return url;
  }

  // Receives message from "dump" window
  // FIXME: to be implemented with postMessage ?
  function storeInstanceData (data) {
    if (localStorage) {
      localStorage.setItem('lastDump', data);
    }
  }

  // Receives message from "input" window
  // FIXME: to be implemented with postMessage ?
  function handleInstanceData (data) {
    appController.handleInstanceData (data);
  }

  // Receives message from "input" window
  // FIXME: to be implemented with postMessage ?
  function retrieveInstanceData (data) {
    var failover = 'No stored data found';
        saved = localStorage ? (localStorage.getItem('lastDump') || failover) : failover;
    $('#input', appController.inputPopupWindow.document).val(saved);
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
      this.dumpPopupWindow = null;
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
      $('#titleUrl').html('Enter a template file path in the input field above or preselect one then hit [Transform] to generate the editor').attr('class', 'hint');
      $('input.editing').attr('disabled', 'disabled');
      updateTransform();
      if (window.location.hash) {
        window.location.hash = '';
      }
    },

    setPreferences : function () {
      var n = document.getElementById('prefs');
      if (n.value === 'Show') {
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
        n.value = 'Show'; // toggle state
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
      updateTransform();
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
        xtdom.setAttribute(n, 'value', 'Show all');
        this.previewMode = 1;
        if (window.jQuery) {
          // triggers preview event on main document
          $(document).triggerHandler('axel-preview-on', [this]);
        }
      } else {
        xtdom.removeClassName (body, 'preview')
        xtdom.setAttribute(n, 'value', 'Preview');
        this.previewMode = 0;
        if (window.jQuery) {
          // triggers preview event on main document
          $(document).triggerHandler('axel-preview-off', [this]);
        }
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
      // do not transform introductory page when reset after load failure
      if (window.location.href.replace('editor.xhtml', 'extras/intro.xhtml')
          === $('#container').get(0).contentWindow.location.href) {
        return;
      }
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
          $('input.editing').removeAttr('disabled'); // enable editor's commands
        } else {
          this.log('Self-transformed template detected : the editor has failed to plug on its AXEL object', 1);
        }
      } else {
        if ($('div[data-template]', iframeDoc).add('body[data-template="#"]', iframeDoc).length === 0) {
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
              $('input.editing').removeAttr('disabled'); // enable editor's commands
            }
          }
        } else {
          this.curForm = undefined;
          this.log('Template with embedded transformation command detected - use AXEL-FORMS editor to transform it !', 1);
          if (window.jQuery) {
            // triggers completion event on main document => forward to AXEL-FORMS
            $(document).triggerHandler('axel-editor-ready', [this]);
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
          log.doc.writeln('<p><i>This is an abstract representation of the implicit schema of the template.');
          log.doc.writeln('Terminal optional elements may be false positive, this is a known bug</i>. Use it only with an empty document !</p>');
          log.doc.writeln('<ul><li>@ : attribute</li><li>* : repeatable element</li><li>| : choice alternative</li><li>? : optional element or attribute</li><li><i>anonymous</i> : complex unnamed type</ul>');

          log.doc.writeln('<hr/>');
          log.dumpSchema(this.curForm);
          log.doc.writeln('<hr/>');
        } else {
          alert('Missing "schema" serializer algorithm, check required source file is included !');
        }
      }
    },

    // Dumps the currently opened template document in a new window
    dump : function () {
      var dump,
          _this = this,
          algo = this.getPreferredAlgo('save');
          params = "width=600,height=400,status=yes,resizable=yes,scrollbars=yes";
      if (algo && this.checkTemplate ()) {
        if (xtiger.cross.UA.IE) {
          this.dumpPopupWindow = window.open(_DUMP_FILE);
        } else {
          this.dumpPopupWindow = window.open(_DUMP_FILE, "Document Data Dump", params);
          this.dumpPopupWindow.focus ();
        }
        this.chooseSerializer();
        dump = new xtiger.util.DOMLogger ();
        this.curForm.serializeData (dump);
        $(this.dumpPopupWindow).bind('load', function () { $('#input', _this.dumpPopupWindow.document).val(dump.dump('*')); });
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

    // HTML5 Chrome (webkit URL) way to download document content as a file
    // FIXME: would be better to open a file dialog to select where to load file but this does not seem possible !
    localDownloadInstanceData : function () {
      var dump, textFileAsBlob, fileNameToSaveAs, downloadLink;
      if (this.checkTemplate()) {
        // var filePath = xtiger.util.fileDialog('save', "*.xml; *.xhtml; *.html", "Select a file to save XML data");
        try {
          this.chooseSerializer();
          dump = new xtiger.util.DOMLogger ();
          this.curForm.serializeData (dump);
          textFileAsBlob = new Blob([dump.dump('*')], {type:'text/xml'});
          fileNameToSaveAs = prompt("How do you want to call the file ?", "document.xml")
          downloadLink = document.createElement("a");
          downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
          downloadLink.download = fileNameToSaveAs;
          downloadLink.click();
        } catch (e) {
          alert('Your browser does not yet support creating local URL objects for download');
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
        this.inputPopupWindow = window.open(_INPUT_FILE, "Document Data Input", params);
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

    // Opens HTML5 file input dialog
    localLoadInstanceData : function (inputName) {
      if (this.checkTemplate()) {
        $('#fileToLoad').get(0).click(); // trick to display file selection dialog box
      }
    },

    // Loads XML content into the editor using HTML5
    localFileSelected : function (ev) {
      var fileToLoad, fileReader, _this = this;
      if (this.checkTemplate()) {
         fileToLoad = (ev.target.files.length > 0) ? ev.target.files[0] : null;
         if (fileToLoad) {
          if ((fileToLoad.type === 'text/xml') || (fileToLoad.type === 'application/xhtml+xml')) {
            fileReader = new FileReader();
            fileReader.onload = function(fileLoadedEvent)
            {
              var textFromFile = fileLoadedEvent.target.result;
              _this.handleInstanceData(textFromFile);
            };
            fileReader.onloadend = function(fileLoadedEvent) {
              if (this.readyState !== FileReader.DONE) {
                _this.log('Error while loading XML data into the editor', 1);
              }
            }
            fileReader.readAsText(fileToLoad, "UTF-8");
          } else {
            alert('Choose an XML file');
          }
        }
      }
    },

    // Reset current document (i.e. reload template and transform it)
    newDocument : function () {
      if (this.checkTemplate()) {
        this.submitPage();
        // FIXME: implement this directly at the AXEL level w/o reloading
      }
    },

    // Opens a window with an iframe to display the current template source code
    // It uses the view-source: URL protocol with relative URLs, so currently it works
    // only with Firefox (chrome does not seem to like relative URLs)
    // FIXME: show the template with a full source code editor and add a test command
    // (see for instance http://javascript.info/play/html)
    viewTemplateSource : function () {
      var location, win, div;
      if (appController.checkTemplate()) {
        location = "view-source:" + document.getElementById("url").value;
        win = window.open(null, "Template source", 'width=800,height=800,location=no,toolbar=no,menubar=no');
        win.focus();
        // creates a document in popup window and default message for unsupported browsers
        win.document.open();
        win.document.write('To actually see the template source code in this window you must use a browser supporting the view-source protocol');
        win.document.close();
        win.document.title = "Source of '" + document.getElementById("url").value + "'";
        div = win.document.createElement('div');
        div.innerHTML = '<iframe src="' + "JavaScript:'To actually see the template source code in this window you must use a browser supporting the view-source protocol with relative URLs like Firefox'" + '" frameborder="0" style="width:100%;height:100%"><iframe>';
        win.document.body.replaceChild( div, win.document.body.firstChild );
        win.document.body.style.margin = "0";
        win.onload = function() {
          var doc = win.frames[0].document;
          $('pre', doc).css('white-space', 'pre-wrap'); // trick to wrap lines (Firefox)
        }
        // actually instructs to view template source
        $('iframe', div).attr('src',location);
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
        alert('You must select and visualize a template first !');
        return false;
      }
      return true;
    },

    log : function (msg, level) {
      $('#titleUrl').html(msg);
      if (1 == level)
        $('#titleUrl').attr('class', 'error');
      else
        $('#titleUrl').attr('class', 'info');
    },

    getFirstSelectedIndexFromSelect : function (sel) {
      for (var i = 0; i < sel.options.length; i++) {
              if (sel.options[i].selected) {
          break;
          }
      }
      return i;
    },

    setSelection : function (sel, rank) {
      for (var i = 0; i < sel.options.length; i++) {
        if (i === rank) {
          sel.options[i].selected = true;
        } else {
          sel.options[i].selected = false;
        }
      }
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
          this.log(list.error, 0); // shows as an info message
        } else if (list.isEmpty()) { // empty, leave template list to default
          this.log("Template files list from '" + model.path + "' is empty, menu content has been filled with defaults.", 0);
        } else { // sucess
          model.files = list.getFiles(); // overrides defaults
        }
        model.loaded = true;
      }
      this._initTemplatesMenu(model.files);
      this.templatePath = model.path;
      this.templateList = model.files;
    },


    // implements hash conversion to preselection so that for instance
    // #samples/Article directly transform the Article.xhtml template
    loadFromHash : function () {
      var t, module, name, i, j;
      if (location.hash && (location.hash.split('/').length === 2)) {
        t = location.hash.split('/');
        module = t[0].substr(1);
        name = t[1];
        window.console.log('Checking hash ' + module + "|" + name);
        for (i = 0; i < this.menuModel.length; i++) {
          window.console.log('Checking ' + this.menuModel[i].name);
          if (this.menuModel[i].name === module) {
            break
          }
        }
        if (i < this.menuModel.length) {
          this.installTemplateMenu(i);
          this.setSelection(document.getElementById('foldersList'), i);
          for (j = 0; j < this.menuModel[i].files.length; j++) {
            if (this.menuModel[i].files[j].substr(0, name.length) === name) {
              break
            }
          }
          if (j < this.menuModel[i].files.length) { // hash points to a preselection
            this.setSelection(document.getElementById('templatesList'), j);
            this.updateSelectedTemplate();
            // location.hash = ""; // otherwise it breaks axel.css injetion into iframe
            this.submitPage();
          }
        }
      }
    }
  }

  jQuery(function() { initApp(); });
}());

