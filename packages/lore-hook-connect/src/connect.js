var React = require('react');
var storeShape = require('./utils/storeShape');
var _ = require('lodash');
var invariant = require('invariant');
var getDisplayName = require('./utils/getDisplayName');
var _getState = require('./getState');

/**
 * Decorator for React components that allows the component to specify what data they need
 * and will automatically fetch that data if it doesn't exist.
 *
 * @param select: function(getState, props, context){...}
 * @param options: {subscribe: true}
 * @returns Function to pass to the component to be decorated
 *
 * Example usage:
 *
 * Scenario 1: If the component doesn't need to be subscribed to changes in the store (which
 * is the typical scenario) just pass in one argument; the state function and the component:
 *
 * connect(function(getState, props, context){
 *   return {
 *     user: getState('user.current')
 *   }
 * })(React.createClass({...}))
 *
 * Scenario 2: If the component does need to be subscribed to changes in the store, pass in
 * two arguments; the state function and options.
 *
 * connect(function(getState, props, context){
 *    return {
 *       user: getState('user.current')
 *    }
 * }, {
 *    subscribe: true
 * })(React.createClass({...})
 *
 */
module.exports = function(actions, blueprints, reducerActionMap) {

  // provide getState with a copy of lore so it can access reducer-action map
  var getState = _getState(actions, blueprints, reducerActionMap);

  return function connect(select, options = {}) {
    return function(DecoratedComponent) {
      var displayName = 'Connect(' + getDisplayName(DecoratedComponent) + ')';

      return React.createClass({
        displayName: displayName,

        contextTypes: {
          store: storeShape.isRequired
        },

        getInitialState: function () {
          // provide a decorator over getState that will force data to be fetched on mount if desired
          var initialState = this.selectState(this.props, this.context, function getStateOnMount(state, stateKey, params, options) {
            options = options || {};
            return getState(state, stateKey, params, _.assign({}, options, {
              force: options.forceFetchOnMount
            }));
          });

          this.nextState = initialState;
          return {};
        },

        shouldComponentUpdate: function (nextProps, nextState) {
          var nextState = this.selectState(nextProps, this.context, getState);
          this.nextState = nextState;
          return true;
        },

        componentDidMount: function () {
          if (!options.subscribe) {
            return;
          }

          this.unsubscribe = this.context.store.subscribe(function () {
            var nextState = this.selectState(this.props, this.context, getState);

            // Why is setTimeout here?
            //
            // If setTimeout is removed you will get the warning "Connect('ComponentName') is accessing
            // isMounted inside its render() function. render() should be a pure function of props and
            // state."
            //
            // This warning happens because components farther down that chain that call getState in
            // their own connect() wrappers may fire actions, which update the reducer, which calls
            // all callbacks subscribed to the store, which calls this function, which then throws
            // a warning because React checks for the existence of some variable that it can't
            // find and interprets the lack of that variable as someone attempting to call setState()
            // or isMounted() from within the render function.
            //
            // That isn't what we're doing here (what's happening is perfectly valid code flow) but
            // React interprets it incorrectly and throws a warning. So to remove the fairly very noisy
            // warning we're simply going to force the code to wait a tick (~4-10ms) before updating
            // state.

            setTimeout(function () {
              // Because setTimeout() is an asynchronous call we can not guarantee the component is
              // still mounted, so we need to check before updating state
              if (this.isMounted()) {
                this.setState(nextState)
              }
            }.bind(this), 0);
          }.bind(this));
        },

        componentWillUnmount: function () {
          if (this.unsubscribe) {
            this.unsubscribe();
          }
        },

        selectState: function (props, context, getState) {
          const state = context.store.getState();
          const slice = select(getState.bind(null, state), props, context);

          invariant(
            _.isPlainObject(slice),
            'The return value of `select` prop must be an object. Instead received %s.',
            slice
          );

          return slice;
        },

        render: function () {
          return React.createElement(
            DecoratedComponent,
            _.assign({ref: 'decoratedComponent'}, this.nextState, this.props)
          );
        }
      });
    }
  }
};
