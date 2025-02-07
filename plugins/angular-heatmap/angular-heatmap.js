/*
 * Angular Heatmap Directive
 *
 * Copyright 2008-2016 Patrick Wied <heatmapjs@patrick-wied.at> - All rights reserved.
 * Dual licensed under MIT and Beerware license
 *
 */
;(function () {
  'use strict'

  angular
    .module('techen-heatmap', [])
    .directive('heatmap', [
      '$heatmap',
      function ($heatmap) {
        return {
          restrict: 'AE',
          scope: {
            data: '=',
            config: '=',
          },
          link: function (scope, el, attrs) {
            var domEl = el[0]
            var computed = window.getComputedStyle(domEl)
            var defaultCfg = {
              width: +attrs['width'] || +computed['width'].replace('px', ''),
              height: +attrs['height'] || +computed['height'].replace('px', ''),
            }
            var cfg = angular.merge({}, defaultCfg, scope['config'] || {})
            cfg.container = domEl
            var heatmapInstance = h337.create(cfg)

            scope.heatmapInstance = heatmapInstance
            $heatmap.registerInstance(attrs.id || +new Date() + '', heatmapInstance)
          },
          controller: function ($scope) {
            $scope.$watch('config', function (nu, old) {
              if (nu == old) {
                return
              }
              $scope.heatmapInstance.configure(nu)
            })
            $scope.$watch(
              'data',
              function (nu, old) {
                $scope.heatmapInstance.setData(nu)
              },
              true
            )
          },
        }
      },
    ])
    .service('$heatmap', [
      function () {
        var instances = {}
        return {
          registerInstance: function (key, value) {
            instances[key] = value
          },
          getInstance: function (key) {
            return instances[key]
          },
          getAllInstances: function () {
            return instances
          },
        }
      },
    ])
})()
