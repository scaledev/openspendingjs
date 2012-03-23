OpenSpending = "OpenSpending" in window ? OpenSpending : {};

(function ($) {

  OpenSpending.Treemap = function (elem, context, state) {
  var self = this;

  var scripts = ["http://assets.openspending.org/openspendingjs/master/lib/vendor/underscore.js",
                 "http://assets.openspending.org/openspendingjs/master/lib/aggregator.js",
                 "http://assets.openspending.org/openspendingjs/master/lib/utils/utils.js",
                 "http://assets.openspending.org/openspendingjs/master/app/treemap/js/thejit-2.js"
                 ];

  elem.html('<div class="treemap-qb"></div><div id="treemap-wrapper" class="treemap-vis"></div>');
  this.$e = elem.find('.treemap-vis');
  this.$qb = elem.find('.treemap-qb');

  this.context = context;
  this.state = state;

  this.configure = function() {
    self.context.label = 'Create a TreeMap visualisation';
    var qb = new OpenSpending.Widgets.QueryBuilder(
      self.$qb, self.update, self.context, [
            {
              variable: 'drilldown',
              label: 'Tiles:',
              type: 'select',
              single: true,
              'default': self.state.drilldown,
              help: 'The sum for each member of this dimension will be presented as a tile on the treemap.'
            },
            {
              variable: 'cuts',
              label: 'Filters:',
              type: 'cuts',
              'default': self.state.cuts,
              help: 'Limit the set of data to display.'
            }
          ]
    );
  };

  this.update = function(state) {
    self.$e.empty();
    self.state = state;
    var cuts = [];
    if (self.context.time) {
      cuts.push('year:' + self.context.time);
    }
    for (var field in self.state.cuts) {
      cuts.push(field + ':' + self.state.cuts[field]);
    }

    if (typeof self.context.member !== 'undefined' && typeof self.context.dimension !== 'undefined') {
      cuts.push(self.context.dimension + ':' + self.context.member);
    }

    if (self.state.drilldown) {
      new OpenSpending.Aggregator({
        siteUrl: self.context.siteUrl,
        dataset: self.context.dataset,
        drilldowns: [self.state.drilldown],
        cuts: cuts,
        rootNodeLabel: 'Total',
        callback: function(data) {
          self.setDataFromAggregator(this.dataset, this.drilldowns[0], data);
          self.draw();
        }
      });
    }
  };

  this.serialize = function() {
    return self.state;
  };

  this.init = function () {
    self.$e.addClass("treemap-widget");
    self.update(self.state);
  };

  this.setDataFromAggregator = function (dataset, dimension, data) {
    var needsColorization = true;
    self.data = {children: _.map(data.children, function(item) {
      if (item.color)
        needsColorization = false;

      return {
        children: [],
        id: item.id,
        name: item.label || item.name,
        data: {
            value: item.amount,
            $area: item.amount,
            title: item.label || item.name,
            link: self.context.siteUrl + '/' + dataset + '/' + dimension + '/' + item.name,
            $color: item.color || '#333333'
          }
        };
    })};

    if (needsColorization) {
      this.autoColorize();
    }
  };

  this.autoColorize = function() {
    var nodes = self.data.children.length;
    var colors = OpenSpending.Utils.getColorPalette(nodes);
    for (var i = 0; i < nodes; i++) {
      self.data.children[i].data.$color = colors[i];
    }
  };

  this.draw = function () {
    console.log(self.data);
    if (!self.data.children.length) {
      $(self.$e).hide();
      return;
    }
    $(self.$e).show();
    self.tm = new $jit.TM.Squarified({
        injectInto: self.$e.prop('id'),
        levelsToShow: 1,
        titleHeight: 0,
        animate: true,

        offset: 2,
        Label: {
          type: 'HTML',
          size: 12,
          family: 'Tahoma, Verdana, Arial',
          color: '#DDE7F0'
          },
        Node: {
          color: '#243448',
          CanvasStyles: {
            shadowBlur: 0,
            shadowColor: '#000'
          }
        },
        Events: {
          enable: true,
          onClick: function(node) {
            if(node) {
                document.location.href = node.data.link;
            }
          },
          onRightClick: function() {
            self.tm.out();
          },
          onMouseEnter: function(node, eventInfo) {
            if(node) {
              node.setCanvasStyle('shadowBlur', 8);
              node.orig_color = node.getData('color');
              node.setData('color', '#A3B3C7');
              self.tm.fx.plotNode(node, self.tm.canvas);
              // tm.labels.plotLabel(tm.canvas, node);
            }
          },
          onMouseLeave: function(node) {
            if(node) {
              node.removeData('color');
              node.removeCanvasStyle('shadowBlur');
              node.setData('color', node.orig_color);
              self.tm.plot();
            }
          }
        },
        duration: 1000,
        Tips: {
          enable: true,
          type: 'Native',
          offsetX: 20,
          offsetY: 20,
          onShow: function(tip, node, isLeaf, domElement) {
            var html = '<div class="tip-title">' + node.name +
                ': ' + OpenSpending.Utils.formatAmount(node.data.value) +
                '</div><div class="tip-text">';
            var data = node.data;
            tip.innerHTML = html; 
          }  
        },
        //Implement this method for retrieving a requested  
        //subtree that has as root a node with id = nodeId,  
        //and level as depth. This method could also make a server-side  
        //call for the requested subtree. When completed, the onComplete   
        //callback method should be called.  
        request: function(nodeId, level, onComplete){  
          // var tree = eval('(' + json + ')');
          var tree = json;  
          var subtree = $jit.json.getSubtree(tree, nodeId);  
          $jit.json.prune(subtree, 1);  
          onComplete.onComplete(nodeId, subtree);  
        },
        //Add the name of the node in the corresponding label
        //This method is called once, on label creation and only for DOM labels.
        onCreateLabel: function(domElement, node){
            domElement.innerHTML = "<div class='desc'><h2>" + OpenSpending.Utils.formatAmount(node.data.value) + "</h2>" + node.name + "</div>";
            }
    });
    self.tm.loadJSON(this.data);
    self.tm.refresh();
  };

  // The rest of this function is suitable for copypasta into other
  // plugins: load all scripts we need, and return a promise object
  // that will fire when the class is ready
  var dfd = $.Deferred();
  dfd.done(function(that) {that.init();});

  // Brutal, but it makes debugging much easier
  //$.ajaxSetup({cache: true});
  var loaders = $.map(scripts, function(url, i) {return $.getScript(url);});
  $.when.apply(null, loaders).done(function() {dfd.resolve(self);});

  return dfd.promise();
};

})(jQuery);

