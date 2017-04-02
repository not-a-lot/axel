$(
  // Extracts xt:attribute and xt:use from <div class="demo"> fragments
  // Generates and insert the source code before the fragment
  // NOTE: MUST be called before transforming the template !
  function sourceDemo () {

    // FIXME: dumpXML works only with terminal nodes or with nodes containing only terminal nodes
    function dumpXML(el) {

      function escape(s) {
        return s.replace(/&/g, '&amp;');
      }

      let tmp, accu = [];
      const nodeName = el.nodeName.toLowerCase();
      $.each(el.attributes, function(index, attr) {
        accu.push(attr.nodeName + "='" + escape(attr.nodeValue) + "'");
      });
      if (el.children.length > 0) { // non text content 
        tmp = [];
        $.each(el.children, function(index, el) {
          tmp.push(dumpXML(el));
        });
        return '&lt;' + nodeName + ' ' + accu.join(' ') + '>' + tmp.join() + '&lt;/' + nodeName + '>';
      } else if (el.textContent) {
        return '&lt;' + nodeName + ' ' + accu.join(' ') + '>' + escape(el.textContent).replace(/</g, '&lt;') + '&lt;/' + nodeName + '>';
      } else {
        return '&lt;' + nodeName + ' ' + accu.join(' ') + '/>';
      }
    }

    // TODO : is this really what we want ? What about xt:repeat and other non-xt nested elements ?
    document.querySelectorAll("div.extract").forEach(function(div) {
      // it doesn't seem to be possible to use an "OR" syntax in the node name
      const xtElems = Array.from(div.getElementsByTagNameNS("http://ns.inria.org/xtiger", "*"));
      const buffer = xtElems.map(function(elem) {
        const nodeName = elem.nodeName.toLowerCase();
        if (nodeName === 'xt:use' || nodeName === 'xt:attribute') {
           return dumpXML(elem);
        }
      });
      const src = "<div class='source'><pre>" + buffer.join('<br/>') + "</pre></div>";
      try {
        div.insertAdjacentHTML('beforebegin', src);
      } catch (e) {
        console.error(e);
      }
    });
  }
);