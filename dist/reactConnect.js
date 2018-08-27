'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var React = require('react');

var lifeCycleMethods = ['componentDidCatch', 'componentDidMount', 'componentDidUpdate', 'componentWillMount', 'componentWillReceiveProps', 'componentWillUnmount', 'componentWillUpdate', 'getSnapshotBeforeUpdate', 'render', 'shouldComponentUpdate', 'UNSAFE_componentWillMount', 'UNSAFE_componentWillReceiveProps', 'UNSAFE_componentWillUpdate', 'constructor', 'length', 'toString'];

module.exports = function (model, fieldsToInclude) {
	return function (Component) {
		var ComposedAtomComponent = function (_React$PureComponent) {
			_inherits(ComposedAtomComponent, _React$PureComponent);

			function ComposedAtomComponent(props) {
				_classCallCheck(this, ComposedAtomComponent);

				// Add all non-prototype methods here.
				var _this = _possibleConstructorReturn(this, (ComposedAtomComponent.__proto__ || Object.getPrototypeOf(ComposedAtomComponent)).call(this, props));

				_this.__listeners = [];
				_this.state = {};

				_this.syncOnModelChange = function (model, key) {
					var args = [key, function (value) {
						_this.setState(_defineProperty({}, key, value));
					}];
					model.on.apply(model, args);
					_this.__listeners.push(function () {
						model.off.apply(model, args);
					});
				};

				Object.getOwnPropertyNames(Component.prototype).forEach(function (key) {
					var value = Component.prototype[key];
					if (key === 'setDisabled') global.ttt = _this;
					if (typeof value === 'function' && !lifeCycleMethods.includes(key) && !_this[key]) {
						_this[key] = function () {
							for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
								args[_key] = arguments[_key];
							}

							var component = _this.getComponent();
							if (component) {
								return value.apply(component, args);
							} else {
								throw new Error('ComposedAtomComponent can\'t call "' + key + '" function, when wrapped component is not available.');
							}
						};
					}
				});

				_this.__WRAPPED_COMPONENT__ = Component;

				var modelToSync = typeof model === 'string' ? props[model] : model;
				_this.state = _this.syncStateWithModel(modelToSync, fieldsToInclude);
				return _this;
			}

			_createClass(ComposedAtomComponent, [{
				key: 'componentWillUnmount',
				value: function componentWillUnmount() {
					this.__listeners.forEach(function (remove) {
						return remove();
					});
					this.__listeners.length = 0;
				}

				/**
     * Copy data from the model into state.
     * state will be synced.
     * @param	{Object} model	atom model object
     * @param	{Array} fieldsToInclude	Use it to sync just selected fields
     * @return {void}
     */

			}, {
				key: 'syncStateWithModel',
				value: function syncStateWithModel(model, fieldsToInclude) {
					var _this2 = this;

					var modelState = {};

					fieldsToInclude.forEach(function (key) {
						modelState[key] = model.get(key);
						_this2.syncOnModelChange(model, key);
					});

					return modelState;
				}
			}, {
				key: 'getComponent',
				value: function getComponent() {
					return this.refs.component;
				}
			}, {
				key: 'render',
				value: function render() {
					return React.createElement(Component, _extends({ ref: 'component' }, this.state, this.props));
				}
			}]);

			return ComposedAtomComponent;
		}(React.PureComponent);

		return ComposedAtomComponent;
	};
};