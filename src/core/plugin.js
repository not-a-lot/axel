/* ***** BEGIN LICENSE BLOCK *****
 *
 * @COPYRIGHT@
 *
 * This file is part of the Adaptable XML Editing Library (AXEL), version @VERSION@
 *
 * @LICENSE@
 *
 * Web site : http://media.epfl.ch/Templates/
 *
 * Author(s) : Stephane Sire
 *
 * ***** END LICENSE BLOCK ***** */

/*****************************************************************************\
|                                                                             |
|  AXEL Plugin                                                                |
|                                                                             |
|  manages plugins life cycle (registration)                                  |
|  exposed as $axel.plugin                                                    |
|                                                                             |
|*****************************************************************************|
|                                                                             |
|  Global functions:                                                          |
|    $axel.plugin.register                                                    |
|        registers a plugin object                                            |
|                                                                             |
\*****************************************************************************/
xtiger.editor.Plugin = function () {
}

xtiger.editor.Plugin.prototype = {
 pluginEditors : {},

 // Returns a factory for the xtigerSrcNode if it corresponds to a primitive editor
 // typesArray is an Array containing the list of types for the node
 getEditorFor : function (xtigerSrcNode, typesArray){
   var factory, editor;
   if (typesArray.length === 1) { // currently only 'singleton' use/bag may be primitive editors...
     editor = typesArray[0];
     factory = this.pluginEditors[editor];
   }
   return factory;
 },

 // Returns true if the xtigerSrcNode corresponds to a primitive editor
 // typesStr is a String representing the list of types for the node
 hasEditorFor : function (xtigerSrcNode, typesStr) {
   var res, editor;
   if (this.pluginEditors[typesStr]) {
     res = true;
   } else {
     var editor = typesStr;
     res = (this.pluginEditors[editor] !== undefined);
   }
   return res;
 }
};

(function ($axel) {

  var _keyCounter = 0; // counter for key generation

  function createUniqueKey ( type ) {
   return type + (_keyCounter++);
  }

  ////////////////////////////////
  // Basic Plugin methods       //
  ////////////////////////////////

  // NOTE: these methods are imported to the plugin K using a mixin approach
  //       maybe they could be inherited from a base plugin K instead ?
  var _pluginK = {

   // FIXME: transitional while adopting new API
   load : function (aPoint, aDataSrc) {
     this.onLoad(aPoint, aDataSrc);
   },

   // FIXME: transitional while adopting new API
   save : function (aLogger) {
     this.onSave(aLogger);
   },

   _init : function ( aHandle, aDocument, aKey ) {
     this._document = aDocument;
     this._key = aKey;
     this._handle = aHandle;
     this._isModified = false;
   },

   // Initializes _param, _option, _content from the template DOM node
   // <xt:use _param="..." _option="...">_content</xt:use>
   // <xt:attribute _param="..." _option="..." default="_content"/>
   _parseFromTemplate : function (aXTNode) {
     var tmp;
     this._param = {};
     xtiger.util.decodeParameters(aXTNode.getAttribute('param'), this._param);
     this._content = xtdom.extractDefaultContentXT(aXTNode);
     tmp = aXTNode.getAttribute('option');
     this._option = tmp ? tmp.toLowerCase() : null;
   },

   // Initializes _param, _option, _content from the seed
   _parseFromSeed : function (aSeed) {
     this._param = {};
     $axel.extend(this._param, aSeed[1], false, true); // takes a snapshot
     this._content = aSeed[2];
     this._option = aSeed[3];
   },

   makeSeed : function () {
     if (! this._seed) { // lazy creation
       this._seed = [this._getKFactory(), this._param, this._content, this._option];
     }
     return this._seed;
   },

   getParam : function (name) {
     return this._param[name] || this._getKParam(name);
   },

   getDefaultData : function () {
     return this._content;
   },

   // FIXME: maybe we should memorize all the attributes from the XTiger xt:use
   // or xt:attribute source node and use a generic getAttribute method instead ?
   // Alternatively we could also merge these attributes with the param hash ?
   getOption : function () {
     return this._option;
   },

   // Dynamicall sets a parameter value
   // TODO: manage type conversion if value is associated with a type when registering plugin
   configure : function ( key, value ) {
     if (value === undefined) {
       delete this._param[key];
     } else {
       this._param[key] = value;
     }
   },

   getUniqueKey : function () {
     return this._key;
   },

   getDocument : function () {
     return this._document;
   },

   getHandle : function () {
     return this._handle;
   },

   setModified : function (isModified) {
     this._isModified = isModified;
   },

   isModified : function () {
     return this._isModified;
   },

   isOptional : function () {
     return false;
   },

   isFocusable : function () {
     return false;
   },

   focus : function () {
   },

   unfocus : function () {
   }
  };

  ////////////////////////////
  // Optional plugin Mixin  //
  ////////////////////////////
  var _pluginOptionK = {

   // extends instance with properties : _isOptional, _isOptionSet, _optCheckBox
   _onInitOption : function () {
     var option = this.getOption();
     if (option) { // option attribute was declared on XTiger node
       this._isOptional = true;
       this._optCheckBox = this._handle.previousSibling; // see PluginFactory.createModel
       if (option === 'unset') {
         // Quirk to prevent unset to return immediately before calling set / unset
         this._isOptionSet = true;
      }
      (option === 'set') ? this.set(false) : this.unset(false);
     } else {
       // do as if not optional (FIXME: print a warning "missing option attribute in template" ?)
       this._isOptional = false;
     }
   },

   _onAwakeOption : function () {
     var _this = this;
     if (this.isOptional()) {
       xtdom.addEventListener(this._optCheckBox, 'click', function(ev) {
         _this.onToggleOpt(ev);
       }, true);
     }
   },

   // Overwrites original plugin method
   isOptional : function () {
     return this._isOptional;
   },

   isSet : function () {
     return this._isOptional && this._isOptionSet;
   },

   set : function(doPropagate) {
     // propagates state change in case some repeat ancestors are unset
     // at that moment
     if (doPropagate) {
       if (!this.getParam('noedit')) {
         xtiger.editor.Repeat.autoSelectRepeatIter(this.getHandle(true));
       }
       xtdom.removeClassName(this.getHandle(), 'axel-repeat-unset');
     }
     if (! this._isOptionSet) { // Safety guard (defensive)
       this._isOptionSet = true;
       if (this._isOptional) {
         xtdom.removeClassName(this.getHandle(), 'axel-option-unset');
         xtdom.addClassName(this.getHandle(), 'axel-option-set');
         this._optCheckBox.checked = true;
       }
     }
   },

   unset : function (doPropagate) {
     if (this._isOptionSet) { // Safety guard (defensive)
       this._isOptionSet = false;
       if (this._isOptional) {
         xtdom.removeClassName(this._handle, 'axel-option-set');
         xtdom.addClassName(this._handle, 'axel-option-unset');
         this._optCheckBox.checked = false;
       }
     }
   },

   onToggleOpt : function (ev) {
     this._isOptionSet ? this.unset(true) : this.set(true);
   }
  };

  ///////////////////////////////////////////////////////
  // Plugin Factory                                    //
  // ---                                               //
  // There will be one instance per registered plugin  //
  ///////////////////////////////////////////////////////
  function PluginFactory ( name, spec, defaults, klassdefs ) {
    this.type = name;
    this.spec = spec;
    this.defaults = defaults;
    this.klassdefs = klassdefs;
    this.klass = null; // lazy creation for unfiltered klass
    this.fklass = {}; // lazy creation for filtered klass
  }

  PluginFactory.prototype = {

   filterRe : /filter=\s*([\w\s]*);?/,
   
   // Instantiates the editor plugin instance (with late editor class creation if required) 
   // use it to generate the handle and initializes it
   // FIXME: merge aXTUse with aXTUseAux (not sure when they should diverge)
   createEditor : function createEditor(aContainer, aXTUse, aDocument, aXTUseAux) {
     var handle,
         f, inst, fsign, m, klass, 
         param = aXTUseAux.getAttribute('param');
     // Computes editor's class signature, creates it and instantiates editor
     if (this.spec.filterable && param) {
       m = this.filterRe.exec(param); // FIXME: trim tail whitespace
       if (m) {
         fsign = m[1];
       }
     }
     klass = this.getKlass(fsign);
     inst = new klass();
     inst._parseFromTemplate(aXTUseAux);
     // Generates handle and editor's markup
     handle = inst.onGenerate(aContainer, aXTUse, aDocument);
     handle.xttPrimitiveEditor = inst;
     // Adds optional "optionality" feature (option="set|unset")
     if (this.spec.optional) {
       var option = aXTUse.getAttribute('option');
       if (option) {
         var check = xtdom.createElement(aDocument, 'input');
         xtdom.setAttribute(check, 'type', 'checkbox');
         xtdom.addClassName(check, 'axel-option-checkbox');
         aContainer.insertBefore(check, handle);
       }
     }
     // Terminates editor's initialization
     inst._init(handle, aDocument, createUniqueKey(this.type));
     inst.onInit(inst.getDefaultData(), inst.getOption()); // life cycle routine
     inst.onAwake(); // FIXME: separate event registration (for filters)
     if (this.spec.optional) { // optional "optionality" mixin
       inst._onInitOption();
       inst._onAwakeOption();
     }
   },

   createEditorFromSeed : function createEditorFromSeed (aSeed, aClone, aDocument, aRepeater) {
     var fsign, inst, klass;
     fsign = this.spec.filterable ? aSeed[1]['filter'] : undefined; // FIXME: how to enforce that convention ?
     klass = this.getKlass(fsign);
     inst = new klass();
     inst._parseFromSeed(aSeed);
     inst._init(aClone, aDocument, createUniqueKey(this.type));
     inst.onInit(inst.getDefaultData(), inst.getOption(), aRepeater); // life cycle routine
     inst.onAwake(); // FIXME: separate event registration (for filters)
     if (this.spec.optional) {
       inst._onInitOption();
       inst._onAwakeOption();
     }
     return inst;
   },

   // Returns the klass constructor for fsign plugin if it exists,
   // creates it and returns it otherwise
   getKlass : function (fsign) {
     //xtiger.cross.log('debug', 'looking for klass ' + this.type + (fsign ? '-[' + fsign + ']' : ''));
     if (fsign) {
       if (! this.fklass[fsign]) {
         this.createPluginKlass(fsign);
       }
       return this.fklass[fsign];
     } else {
       if (! this.klass) {
         this.createPluginKlass(fsign);
       }
       return this.klass;
     }
   },

    createPluginKlass : function (fsign) {
      // dynamically create plugin class
      var kDefaults, klass = new Function();

      // computes static klass-level default parameters
      if (this.spec.filterable && fsign) {
        kDefaults = {};
        $axel.extend(kDefaults, this.defaults);
        this.applyFiltersDefaults(kDefaults, fsign);
      } else {
        kDefaults = this.defaults;
      }

      // dynamically populate plugin class prototype
      // using a closure to remember shared klass level parameters
      klass.prototype = (function (defaults, factory) {
        var _FACTORY = factory, // static klass factory
            _DEFAULTS = defaults; // static klass level default params
        return {
         _getKFactory : function () { return _FACTORY; },
         _getKParam : function (name) { return _DEFAULTS[name]; }
        };
      }(kDefaults, this));

      $axel.extend(klass.prototype, _pluginK);
      if (this.spec.optional) {
        $axel.extend(klass.prototype, _pluginOptionK, false, true);
      }

      // copy life cycle methods
      klass.prototype.onGenerate = this.klassdefs.onGenerate || function (aContainer, aXTUse, aDocument) { alert( 'plugin ' + aXTUse.getAttribute('types') + ' missing onGenerate function !') };
      klass.prototype.onInit = this.klassdefs.onInit;
      klass.prototype.onAwake = this.klassdefs.onAwake;
      klass.prototype.onLoad = this.klassdefs.onLoad;
      klass.prototype.onSave = this.klassdefs.onSave;

      // overwrite basic plugin methods
      // FIXME: check method exists before overwriting to print warnings
      $axel.extend(klass.prototype, this.klassdefs.api, false, true);

      // add specific methods
      // FIXME: check method does not exist to print warnings
      $axel.extend(klass.prototype, this.klassdefs.methods);

      // add filter methods
      if (this.spec.filterable && fsign) {
        this.applyFilters(klass.prototype, fsign);
      }

      // stores klass
      if (fsign) {
        this.fklass[fsign] = klass;
      } else {
        this.klass = klass;
      }
      // xtiger.cross.log('debug', 'lazy creation for klass ' + this.type + (fsign ? '-[' + fsign + ']' : ''));
    }
  };

  $axel.plugin = $axel.plugin || {};

  /////////////////////////////
  // Public module functions //
  /////////////////////////////

  $axel.plugin.register = function ( name, spec, defaults, klassdefs ) {
   var pluginK;
   if (xtiger.editor.Plugin.prototype.pluginEditors[name]) {
     xtiger.cross.log('error', 'plugin "' + name + '" has already been registered, registration aborted');
   } else {
     xtiger.cross.log('info', 'registering plugin "' + name + '"');
     // dynamically create plugin factory class
     // factoklass will create the plugin classes on the fly
     factoklass = new PluginFactory(name, spec, defaults, klassdefs);
     // registers plugin class and specification
     if (spec.filterable) {
       xtiger.editor.Plugin.prototype.pluginEditors[name] = xtiger.util.filterable(name, factoklass);
     } else {
       xtiger.editor.Plugin.prototype.pluginEditors[name] = factoklass;
     }
   }
  };

  $axel.plugin.list = function () {
    var key, accu = [];
    for (key in xtiger.editor.Plugin.prototype.pluginEditors) { accu.push(key); }
    return accu;
  };
}($axel));


