const _ = require('lodash');
const { payloadCollection, defaultOptions, validatePartialPairs } = require('../utils');

/*
 * Blueprint for Find method
 */

module.exports = function(opts = {}) {
  // clone the options so we don't unintentionally modify them
  let options = _.cloneDeep(opts);

  options = _.defaultsDeep(options, defaultOptions);

  if (!options.collection) {
    throw new Error('Must specify a collection');
  }

  const Collection = options.collection;

  validatePartialPairs(options);

  return function fetchAll(query = {}, pagination) {
    return function(dispatch) {
      const collection = new Collection();

      var queryParameters = _.extend({}, query, pagination);

      var combinedQuery = {
        where: query,
        pagination: pagination
      };

      collection.fetch({
        data: queryParameters
      }).then(function() {
        if (options.onSuccess) {
          var actions = [];

          if (options.normalize && options.normalize.getActions) {
            // look through all models in the collection and generate actions for any attributes
            // with nested data that should be normalized
            actions = options.normalize.getActions(collection);
          }

          dispatch({
            type: options.onSuccess.actionType,
            payload: payloadCollection(collection, options.onSuccess.payloadState, null, combinedQuery),
            query: combinedQuery
          });

          if (options.normalize && options.normalize.dispatchActions) {
            // dispatch any actions created from normalizing nested data
            options.normalize.dispatchActions(actions, dispatch);
          }
        }
      }).catch(function(response) {
        if (options.onError) {
          const error = response.data;

          if (options.onError.beforeDispatch) {
            options.onError.beforeDispatch(response, [query]);
          }

          dispatch({
            type: options.onError.actionType,
            payload: payloadCollection(collection, options.onError.payloadState, error, combinedQuery),
            query: combinedQuery
          });
        }
      });

      if (options.optimistic) {
        return dispatch({
          type: options.optimistic.actionType,
          payload: payloadCollection(collection, options.optimistic.payloadState, null, combinedQuery),
          query: combinedQuery
        });
      }
    };
  };
};
