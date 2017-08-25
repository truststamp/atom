/* eslint-disable indent, no-var, prefer-arrow-callback */
// atom.js
// https://github.com/zynga/atom
// Author: Chris Campbell (@quaelin)
// License: BSD
//
(function (undef) {
	'use strict';

	var
		ObjProto = Object.prototype,
		hasOwn = ObjProto.hasOwnProperty,
		typeUndef = '' + undef,
		root = typeof window !== typeUndef ? window : global
	;

	// Convenience methods
	var slice = Array.prototype.slice;
	var isArray = Array.isArray || function (obj) {
		return ObjProto.toString.call(obj) === '[object Array]';
	};
	function isCriticalError(data) {
		return (
			data instanceof EvalError
			|| (typeof InternalError !== 'undefined' && data instanceof InternalError)
			|| data instanceof RangeError
			|| data instanceof ReferenceError
			|| data instanceof SyntaxError
			|| data instanceof TypeError
			|| data instanceof URIError
		);
	}
	function inArray(arr, value) {
		return arr.indexOf(value) > -1;
	}
	function isObject(input) {
		return input && typeof input === 'object';
	}
	function toArray(obj) {
		return isArray(obj) ? obj : [obj];
	}
	function isEmpty(obj) {
		for (var p in obj) {
			if (hasOwn.call(obj, p)) {
				return false;
			}
		}
		return true;
	}
	function clear() {
		Array.prototype.forEach.call(arguments, function(clearMe) {
			Object.keys(clearMe).forEach(function(key) {
				delete clearMe[key];
			});
		});
	}
	var values = Object.values || function(obj) {
		return Object.keys(obj).map(function(k) {
			return obj[k];
		});
	};

	// Property getter
	function get(nucleus, keyOrList, func) {
		var keys = isArray(keyOrList) ? keyOrList : [keyOrList],
			values = [],
			props = nucleus.props,
			missing = {},
			result = { values: values };
		keys.forEach(function(key) {
			if (!hasOwn.call(props, key)) {
				result.missing = missing;
				missing[key] = true;
			}
			values.push(props[key]);
		});
		return func ? func.apply({}, values) : result;
	}

	// Helper to remove an exausted listener from the listeners array
	function removeListener(listeners) {
		for (var i = listeners.length; --i >= 0;) {
			// There should only be ONE exhausted listener.
			if (!listeners[i].calls) {
				return listeners.splice(i, 1);
			}
		}
	}


	// Used to detect listener recursion; a given object may only appear once.
	var objStack = [];

	function performSet(config, nucleus, key, value) {
		var keys,
			listener,
			listeners = nucleus.listeners,
			missing,
			listenersCopy = [].concat(listeners),
			i = listenersCopy.length,
			props = nucleus.props,
			oldValue = props[key],
			had = hasOwn.call(props, key),
			isObj = isObject(value);

		props[key] = value;

		if (!had || oldValue !== value || (isObj && !inArray(objStack, value))) {
			if (isObj) {
				objStack.push(value);
			}
			while (i--) {
				listener = listenersCopy[i];
				keys = listener.keys;
				missing = listener.missing;
				if (missing) {
					if (hasOwn.call(missing, key)) {
						delete missing[key];
						if (isEmpty(missing)) {
							listener.cb.apply({}, get(nucleus, keys).values);
							listener.calls--;
						}
					}
				} else if (inArray(keys, key)) {
					listener.cb.apply({}, get(nucleus, keys).values);
					listener.calls--;
				}
				if (!listener.calls) {
					removeListener(listeners);
				}
			}
			delete nucleus.needs[key];
			if (isObj) {
				objStack.pop();
			}
			if (config.onChange) {
				// disable event triggering for localstorage synchronization lastStorageUpdateTimestamp helper
				if (key !== 'lastStorageUpdateTimestamp') {
					config.onChange(key, value);
				}
			}
			if (config.persistenceLib) {
				// save model to a localStorage for data synchronization across sessions.
				config.persistenceLib.set(
					config.modelName,
					Object.assign({}, nucleus.props, { lastStorageUpdateTimestamp: Date.now() })
				);
			}
		}
	}

	// Property setter
	function set(config, nucleus, key, value, keyOrMap) {
		var validationError = false;
		var promises = {};

		if (config.validation && config.validation[key]) {
			var validation = config.validation[key];

			validationError = Object.keys(validation).find(function(validationKey) {
				var validationResult = validation[validationKey](value, keyOrMap);
				if (typeof validationResult === 'boolean') {
					return !validationResult;
				} else if (validationResult instanceof Promise) {
					promises[validationKey] = new Promise(function(resolve, reject) {
						validationResult
						.then(resolve, function() {
							reject(validationKey);
						});
					});
					return false;
				}

				throw new Error('ERROR: Wrong data type returned by ' + validationKey + 'validator. Expected Boolean or Promise.');
			});
		}

		return new Promise(function(resolve, reject) {
			if (validationError) {
				reject(validationError);
			} else if (Object.keys(promises).length) {
				Promise.all(values(promises))
				.then(function() {
					performSet(config, nucleus, key, value);
					resolve();
				}, reject);
			} else {
				performSet(config, nucleus, key, value);
				resolve();
			}
		});
	}


	// Wrapper to prevent a callback from getting invoked more than once.
	function preventMultiCall(callback) {
		var ran;
		return function () {
			if (!ran) {
				ran = 1;
				callback.apply(this, arguments);
			}
		};
	}


	// Helper function for setting up providers.
	function provide(config, nucleus, key, provider) {
		provider(preventMultiCall(function (result) {
			set(config, nucleus, key, result);
		}));
	}


	// Determine whether two keys (or sets of keys) are equivalent.
	function keysMatch(keyOrListA, keyOrListB) {
		var a, b;
		if (keyOrListA === keyOrListB) {
			return true;
		}
		a = [].concat(toArray(keyOrListA)).sort();
		b = [].concat(toArray(keyOrListB)).sort();
		return a + '' === b + '';
	}


	// Return an instance.
	function atom() {
		if (this instanceof atom) {
			throw new Error("Don't use atom with a `new` keyword please.");
		}

		var
			config = this || {},
			args = slice.call(arguments, 0),
			nucleus = {},
			props = nucleus.props = {},
			needs = nucleus.needs = {},
			providers = nucleus.providers = {},
			listeners = nucleus.listeners = [],
			q = []
		;

		function getParsedValue(key, val) {
			return config.parsers && config.parsers[key]
				? config.parsers[key](val)
				: val;
		}

		if (config.persistent) {
			throw new Error('`persistent` param is abandoned in favour of `persistenceLib`');
		}

		if (config.persistenceLib) {
			if (!config.modelName) {
				throw new Error('Persistent model needs a name to be saved in localStorage. Please provide a "modelName" property.');
			}

			if (typeof config.persistenceLib.set !== 'function') {
				throw new Error('`persistenceLib` property in atom-js model needs to expose `set` method.');
			}
		}
		// Execute the next function in the async queue.
		function doNext() {
			if (q) {
				q.pending = q.next = (!q.next && q.length) ?
					q.shift() : q.next;
				q.args = slice.call(arguments, 0);
				if (q.pending) {
					q.next = 0;
					q.pending.apply({}, [preventMultiCall(doNext)].concat(q.args));
				}
			}
		}

		var me = {

			// Add a function or functions to the async queue.  Functions added
			// thusly must call their first arg as a callback when done.  Any args
			// provided to the callback will be passed in to the next function in
			// the queue.
			chain: function () {
				if (q) {
					for (var i = 0, len = arguments.length; i < len; i++) {
						q.push(arguments[i]);
						if (!q.pending) {
							doNext.apply({}, q.args || []);
						}
					}
				}
				return me;
			},

			// Remove references to all properties and listeners.  This releases
			// memory, and effective stops the atom from working.
			destroy: function () {
				clear(nucleus, config, q);
				q.length = 0;
				nucleus = props = needs = providers = listeners = q = 0;
			},

			// clear all data, keep validation and listeners.
			clear: function() {
				var promises = [];
				me.keys().forEach(function(key) {
					// set undefined without validation, but trigger events
					promises.push(
						me.set(key, undefined, false).then(function() {
							delete props[key];
						})
					);
				});

				return Promise.all(promises);
			},

			// Call `func` on each of the specified keys.  The key is provided as
			// the first arg, and the value as the second.
			each: function (keyOrList, func) {
				var keys = toArray(keyOrList), i = -1, len = keys.length, key;
				while (++i < len) {
					key = keys[i];
					func(key, me.get(key));
				}
				return me;
			},

			// Establish two-way binding between a key or list of keys for two
			// different atoms, so that changing a property on either atom will
			// propagate to the other.  If a map is provided for `keyOrListOrMap`,
			// properties on this atom may be bound to differently named properties
			// on `otherAtom`.  Note that entangled properties will not actually be
			// synchronized until the first change *after* entanglement.
			entangle: function (otherAtom, keyOrListOrMap) {
				var
					isList = isArray(keyOrListOrMap),
					isMap = !isList && isObject(keyOrListOrMap),
					i,
					key,
					keys = isList ? keyOrListOrMap : isMap ? [] : [keyOrListOrMap],
					map = isMap ? keyOrListOrMap : {}
				;
				if (isMap) {
					for (key in map) {
						if (hasOwn.call(map, key)) {
							keys.push(key);
						}
					}
				} else {
					for (i = keys.length; --i >= 0;) {
						key = keys[i];
						map[key] = key;
					}
				}
				me.each(keys, function (key) {
					var otherKey = map[key];
					me.on(key, function (value) {
						otherAtom.set(otherKey, value);
					});
					otherAtom.on(otherKey, function (value) {
						me.set(key, value);
					});
				});
				return me;
			},

			// Get current values for the specified keys.  If `func` is provided,
			// it will be called with the values as args.
			get: function (keyOrList, func) {
				if (arguments.length === 0) {
					return props;
				}
				var result = get(nucleus, keyOrList, func);
				if (!func) {
					result = typeof keyOrList === 'string' ? result.values[0] : result.values;
				}
				return result;
			},

			pick: function (keyOrList) {
				var keysList = [].concat(keyOrList);
				var result = {};
				keysList.forEach(function(key) {
					if (props.hasOwnProperty(key)) {
						result[key] = props[key];
					}
				});
				return result;
			},

			// Returns true iff all of the specified keys exist (regardless of
			// value).
			has: function (keyOrList) {
				var keys = toArray(keyOrList);
				for (var i = keys.length; --i >= 0;) {
					if (!hasOwn.call(props, keys[i])) {
						return false;
					}
				}
				return true;
			},

			// Return a list of all keys.
			keys: function () {
				return Object.keys(props);
			},

			// Add arbitrary properties to this atom's interface.
			mixin: function (obj) {
				for (var p in obj) {
					if (hasOwn.call(obj, p)) {
						me[p] = obj[p];
					}
				}
				return me;
			},

			// Call `func` as soon as all of the specified keys have been set.  If
			// they are already set, the function will be called immediately, with
			// all the values provided as args.  In this, it is identical to
			// `once()`.  However, calling `need()` will additionally invoke
			// providers when possible, in order to try and create the required
			// values.
			need: function (keyOrList, func) {
				var key, keys = toArray(keyOrList), provider;
				for (var i = keys.length; --i >= 0;) {
					key = keys[i];
					provider = providers[key];
					if (!hasOwn.call(props, key) && provider) {
						provide(config, nucleus, key, provider);
						delete providers[key];
					} else {
						needs[key] = true;
					}
				}
				if (func) {
					me.once(keys, func);
				}
				return me;
			},

			// Call `func` whenever any of the specified keys is next changed.  The
			// values of all keys will be provided as args to the function.  The
			// function will automatically be unbound after being called the first
			// time, so it is guaranteed to be called no more than once.
			next: function (keyOrList, func) {
				listeners.unshift({
					keys: toArray(keyOrList),
					cb: func,
					calls: 1
				});
				return me;
			},

			// Unregister a listener `func` that was previously registered using
			// `on()`, `bind()`, `need()`, `next()` or `once()`.  `keyOrList` is
			// optional; if provided, it will selectively remove the listener only
			// for the specified combination of properties.
			off: function (keyOrList, func) { // alias: `unbind`
				var i = listeners.length, listener;
				if (arguments.length === 1) {
					func = keyOrList;
					keyOrList = 0;
				}
				while (--i >= 0) {
					listener = listeners[i];
					if (
						listener.cb === func &&
						(!keyOrList || keysMatch(listener.keys, keyOrList))
					) {
						listeners.splice(i, 1);
					}
				}
				return me;
			},

			// Call `func` whenever any of the specified keys change.  The values
			// of the keys will be provided as args to func.
			on: function (keyOrList, func) { // alias: `bind`
				listeners.unshift({
					keys: toArray(keyOrList),
					cb: func,
					calls: Infinity
				});
				return {
					remove: function() {
						me.remove(keyOrList, func);
					}
				};
			},

			// Call `func` as soon as all of the specified keys have been set.  If
			// they are already set, the function will be called immediately, with
			// all the values provided as args.  Guaranteed to be called no more
			// than once.
			once: function (keyOrList, func) {
				var keys = toArray(keyOrList),
					results = get(nucleus, keys),
					values = results.values,
					missing = results.missing;
				if (missing) {
					listeners.unshift({
						keys: keys,
						cb: func,
						missing: missing,
						calls: 1
					});
				} else {
					func.apply({}, values);
				}
				return me;
			},

			// Register a provider for a particular key.  The provider `func` is a
			// function that will be called if there is a need to create the key.
			// It must call its first arg as a callback, with the value.  Provider
			// functions will be called at most once.
			provide: function (key, func) {
				if (needs[key]) {
					provide(config, nucleus, key, func);
				} else if (!providers[key]) {
					providers[key] = func;
				}
				return me;
			},

			// Set value for a key, or if `keyOrMap` is an object then set all the
			// keys' corresponding values.
			set: function (keyOrMap, valueOrSetConfig, setConfig) {
				var localConfig = config;
				var isMap = isObject(keyOrMap);
				var setConfig = Object.assign({ validate: true }, isMap ? valueOrSetConfig : setConfig);

				if (!setConfig.validate) {
					localConfig = Object.assign({}, localConfig, {
						validation: undef
					});
				}

				if (isMap) {
					var keys = Object.keys(keyOrMap);
					keyOrMap = Object.assign({}, keyOrMap);
					keys.forEach(function(key) {
						keyOrMap[key] = getParsedValue(key, keyOrMap[key]);
					});
					return new Promise(function(resolve, reject) {
						var results = {};
						if (!keys.length) {
							return resolve();
						}
						keys.forEach(function(key) {
							results[key] = set(localConfig, nucleus, key, keyOrMap[key], keyOrMap);
							results[key]
							.then(function() {
								results[key] = false;
							}, function(error) {
								results[key] = error;
							});
							return results[key];
						});
						Promise.all(values(results))
						.then(resolve, function() {
							reject(results);
						});
					});
				}

				return set(localConfig, nucleus, keyOrMap, getParsedValue(keyOrMap, valueOrSetConfig));
			}
		};
		me.bind = me.on;
		me.unbind = me.off;

		if (args.length) {
			args[2] = false; // disable initial validation
			me.set.apply(me, args);
		}

		if (config.methods) {
			Object.keys(config.methods).forEach(function (key) {
				if (me[key]) {
					throw new Error(me[key] + ' already exists in atom-js.');
				}
				var promiseCache = {};
				me[key] = function () {
					var cacheKey = key + ',' + (arguments.length ? JSON.stringify(arguments) : '');
					if (promiseCache[cacheKey]) {
						// OPTIMISATION:
						// Don't create new promise, when old call was not resolved/rejected yet.
						return promiseCache[cacheKey];
					}
					// make all methods Promise.
					var simpleArgs = slice.call(arguments, 0);
					var that = this;
					var promise = new Promise(function (resolve, reject) {
						simpleArgs.unshift(resolve, reject);
						config.methods[key].apply(that, simpleArgs);
					});
					function clearCache() {
						delete promiseCache[cacheKey];
					}
					promise.then(clearCache, function (err) {
						clearCache();
						if (isCriticalError(err)) console.error('atom.js caught Promise error for you!', err);
					});

					promiseCache[cacheKey] = promise;

					return promise;
				};
			});
		}

		return me;
	}

	atom.setup = function (config) {
		// possible options:
		// - validation
		// - onChange
		// - methods
		// - persistenceLib
		// - parsers
		return atom.bind(config);
	};

	if (typeof module !== typeUndef && module.exports) {
		module.exports = atom;
	} else {
		root.atom = atom;
	}
}());
