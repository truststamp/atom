const React = require('react');

const lifeCycleMethods = [
	'componentDidCatch',
	'componentDidMount',
	'componentDidUpdate',
	'componentWillMount',
	'componentWillReceiveProps',
	'componentWillUnmount',
	'componentWillUpdate',
	'getSnapshotBeforeUpdate',
	'render',
	'shouldComponentUpdate',
	'UNSAFE_componentWillMount',
	'UNSAFE_componentWillReceiveProps',
	'UNSAFE_componentWillUpdate',
	'constructor',
	'length',
	'toString',
];

module.exports = (model, fieldsToInclude) => {
	return (Component) => {
		class ComposedAtomComponent extends React.PureComponent {
			__listeners = [];

			state = {};

			constructor(props) {
				super(props);

				// Add all non-prototype methods here.
				Object.getOwnPropertyNames(Component.prototype)
					.forEach((key) => {
						const value = Component.prototype[key];

						if (
							typeof value === 'function'
							&& !lifeCycleMethods.includes(key)
							&& !this[key]
						) {
							this[key] = (...args) => {
								const component = this.getComponent();
								if (component) {
									return value.apply(component, args);
								} else {
									throw new Error(`ComposedAtomComponent can't call "${key}" function, when wrapped component is not available.`);
								}
							}
						}
					});

				this.__WRAPPED_COMPONENT__ = Component;

				const modelToSync = typeof model === 'string' ? props[model] : model;
				this.state = this.syncStateWithModel(modelToSync, fieldsToInclude);
			}

			componentWillUnmount() {
				this.__listeners.forEach((remove) => remove());
				this.__listeners.length = 0;
			}

			/**
			 * Copy data from the model into state.
			 * state will be synced.
			 * @param	{Object} model	atom model object
			 * @param	{Array} fieldsToInclude	Use it to sync just selected fields
			 * @return {void}
			 */
			syncStateWithModel(model, fieldsToInclude) {
				const modelState = {};

				fieldsToInclude.forEach((key) => {
					modelState[key] = model.get(key);
					this.syncOnModelChange(model, key);
				});

				return modelState;
			}

			syncOnModelChange = (model, key) => {
				const args = [
					key,
					(value) => {
						this.setState({
							[key]: value,
						});
					},
				];
				model.on(...args);
				this.__listeners.push(() => {
					model.off(...args);
				});
			}

			getComponent() {
				return this.refs.component;
			}

			render() {
				return (
					<Component ref="component" { ...this.state } { ...this.props } />
				);
			}
		}

		return ComposedAtomComponent;
	}
}
