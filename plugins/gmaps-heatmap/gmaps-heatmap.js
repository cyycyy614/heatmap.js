/*
* heatmap.js Google Maps Overlay
*
* Copyright (c) 2008-2016, Patrick Wied (https://www.patrick-wied.at)
* Dual-licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
* and the Beerware (http://en.wikipedia.org/wiki/Beerware) license.
*/
;(function (name, context, factory) {
  // Supports UMD. AMD, CommonJS/Node.js and browser context
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory(
      require('techen-heatmap.js'),
      require('google-maps')
    );
  } else if (typeof define === "function" && define.amd) {
    define(['heatmap.js', 'google-maps'], factory);
  } else {
    // browser globals
    if (typeof window.h337 === 'undefined') {
      throw new Error('heatmap.js must be loaded before the gmaps heatmap plugin');
    }
    if (typeof window.google === 'undefined') {
      throw new Error('Google Maps must be loaded before the gmaps heatmap plugin');
    }
    context[name] = factory(window.h337, window.google.maps);
  }

})("HeatmapOverlay", this, function(h337, gmaps) {
  'use strict';

  var HeatmapOverlay = function(map, cfg){ 
    this.setMap(map);
    this.initialize(cfg || {});
  };

  HeatmapOverlay.prototype = new gmaps.OverlayView();

  HeatmapOverlay.CSS_TRANSFORM = (function() {
    var div = document.createElement('div');
    var props = [
      'transform',
      'WebkitTransform',
      'MozTransform',
      'OTransform',
      'msTransform'
    ];

    for (var i = 0; i < props.length; i++) {
      var prop = props[i];
      if (div.style[prop] !== undefined) {
        return prop;
      }
    }

    return props[0];
  })();

  HeatmapOverlay.prototype.initialize = function(cfg) {
    this.cfg = cfg;
    
    var map = this.map = this.getMap();
    var container = this.container = document.createElement('div');
    var mapDiv = map.getDiv();
    var width = this.width = mapDiv.clientWidth;
    var height = this.height = mapDiv.clientHeight;

    container.style.cssText = 'width:' + width +'px;height:' + height+'px;';

    this.data = [];
    this.max = 1;
    this.min = 0;

    cfg.container = container;
  };

  HeatmapOverlay.prototype.onAdd = function(){
    var that = this;

    this.getPanes().overlayLayer.appendChild(this.container);


    this.changeHandler = gmaps.event.addListener(
      this.map,
      'bounds_changed',
      function() { return that.draw(); }
    );
   
    if (!this.heatmap) {
      this.heatmap = h337.create(this.cfg);
    }
    this.draw();
  };

  HeatmapOverlay.prototype.onRemove = function() { 
    if (!this.map) { return; }

    this.map = null;

    this.container.parentElement.removeChild(this.container);

    if (this.changeHandler) {
      gmaps.event.removeListener(this.changeHandler);
      this.changeHandler = null;
    }

  };

  HeatmapOverlay.prototype.draw = function() {
    if (!this.map) { return; }

    var bounds = this.map.getBounds();

    var topLeft = new gmaps.LatLng(
      bounds.getNorthEast().lat(),
      bounds.getSouthWest().lng()
    );

    var projection = this.getProjection();
    var point = projection.fromLatLngToDivPixel(topLeft);

    this.container.style[HeatmapOverlay.CSS_TRANSFORM] = 'translate(' +
        Math.round(point.x) + 'px,' +
        Math.round(point.y) + 'px)';

    this.update();
  };

  HeatmapOverlay.prototype.resize = function() {

    if (!this.map){ return; }

    var div = this.map.getDiv(),
      width = div.clientWidth,
      height = div.clientHeight;

    if (width == this.width && height == this.height){ return; }

    this.width = width;
    this.height = height;

    // update heatmap dimensions
    this.heatmap._renderer.setDimensions(width, height);
    // then redraw all datapoints with update
    this.update();
  };

  HeatmapOverlay.prototype.update = function() {
    var projection = this.getProjection(),
      zoom, scale, bounds, topLeft;
    var generatedData = { max: this.max, min: this.min, data: [] };

    if (!projection){ return; }

    bounds = this.map.getBounds();

    topLeft = new gmaps.LatLng(
      bounds.getNorthEast().lat(),
      bounds.getSouthWest().lng()
    );

    zoom = this.map.getZoom();
    scale = Math.pow(2, zoom);

    this.resize();

    if (this.data.length == 0) {
      if (this.heatmap) {
        this.heatmap.setData(generatedData);
      }
      return;
    }


    var latLngPoints = [];
    // iterate through data 
    var len = this.data.length;
    var layerProjection = this.getProjection();
    var layerOffset = layerProjection.fromLatLngToDivPixel(topLeft);
    var radiusMultiplier = this.cfg.scaleRadius ? scale : 1;
    var localMax = 0;
    var localMin = 0;
    var valueField = this.cfg.valueField;


    while (len--) {
      var entry = this.data[len];
      var value = entry[valueField];
      var latlng = entry.latlng;


      // we don't wanna render points that are not even on the map ;-)
      if (!bounds.contains(latlng)) {
        continue;
      }
      // local max is the maximum within current bounds
      localMax = Math.max(value, localMax);
      localMin = Math.min(value, localMin);

      var point = layerProjection.fromLatLngToDivPixel(latlng);
      var latlngPoint = { x: Math.round(point.x - layerOffset.x), y: Math.round(point.y - layerOffset.y) };
      latlngPoint[valueField] = value;

      var radius;

      if (entry.radius) {
        radius = entry.radius * radiusMultiplier;
      } else {
        radius = (this.cfg.radius || 2) * radiusMultiplier;
      }
      latlngPoint.radius = radius;
      latLngPoints.push(latlngPoint);
    }
    if (this.cfg.useLocalExtrema) {
      generatedData.max = localMax;
      generatedData.min = localMin;
    }

    generatedData.data = latLngPoints;

    this.heatmap.setData(generatedData);

  };

  HeatmapOverlay.prototype.setData = function(data) { 
    this.max = data.max;
    this.min = data.min;

    var latField = this.cfg.latField || 'lat';
    var lngField = this.cfg.lngField || 'lng';
    var valueField = this.cfg.valueField || 'value';

    // transform data to latlngs
    var data = data.data;
    var len = data.length;
    var d = [];

    while (len--) {
      var entry = data[len];
      var latlng = new gmaps.LatLng(entry[latField], entry[lngField]);
      var dataObj = { latlng: latlng };
      dataObj[valueField] = entry[valueField];
      if (entry.radius) {
        dataObj.radius = entry.radius;
      }
      d.push(dataObj);
    }
    this.data = d;
    this.update();
  };
  // experimential. not ready yet.
  HeatmapOverlay.prototype.addData = function(pointOrArray) {
    if (pointOrArray.length > 0) {
        var len = pointOrArray.length;
        while(len--) {
          this.addData(pointOrArray[len]);
        }
      } else {
        var latField = this.cfg.latField || 'lat';
        var lngField = this.cfg.lngField || 'lng';
        var valueField = this.cfg.valueField || 'value';
        var entry = pointOrArray;
        var latlng = new gmaps.LatLng(entry[latField], entry[lngField]);
        var dataObj = { latlng: latlng };
        
        dataObj[valueField] = entry[valueField];
        if (entry.radius) {
          dataObj.radius = entry.radius;
        }
        this.max = Math.max(this.max, dataObj[valueField]);
        this.min = Math.min(this.min, dataObj[valueField]);
        this.data.push(dataObj);
        this.update();
      }
  };

  return HeatmapOverlay;

});
