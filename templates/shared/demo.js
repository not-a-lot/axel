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

    document.querySelectorAll("div.extract").forEach(function(div) {
      const useElems = div.getElementsByTagNameNS("http://ns.inria.org/xtiger", "use");
      const attrElems = div.getElementsByTagNameNS("http://ns.inria.org/xtiger", "attribute");
      const xtElems = Array.from(useElems).concat(Array.from(attrElems));
      const buffer = xtElems.map(function(elem) {
        return dumpXML(elem);
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