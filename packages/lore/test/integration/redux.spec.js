var expect = require('chai').expect;
var _ = require('lodash');
var nock = require('nock');
var Lore = require('../../src/app/index');
var loaderHelper = require('../helpers/loaderHelper');
var populateStore = require('../helpers/populateStore');
var config = {
  hooks: require('../defaultHooks')
};
var TEST_DELAY = 50;

describe('lore#redux', function() {
  var lore = null;

  beforeEach(function() {
    lore = new Lore();
  });

  beforeEach(function() {
    loaderHelper.stub({
      models: {
        todo: {}
      }
    });
  });

  describe('action-reducer flow: actions.todo.create() [id as String]', function() {

    beforeEach(function() {
      nock('https://api.example.com')
        .persist()
        .post('/todos')
        .reply(201, {
          id: '1',
          title: 'foo'
        });
    });

    it("should create a todo and add it to the store", function(done) {
      lore.build(config);
      var optimisticTodo = lore.actions.todo.create({
        title: 'foo'
      }).payload;

      // The first time we check state we should see the optimistic response
      var state = lore.store.getState();
      expect(_.keys(state.todo.find).length).to.equal(0);
      expect(_.keys(state.todo.byId).length).to.equal(0);
      expect(_.keys(state.todo.byCid).length).to.equal(1);

      // Subscribe to the store so we can be notified once the server response
      // comes back with the real data
      lore.store.subscribe(_.debounce(function() {

        // The second time we check state we should see the real model
        state = lore.store.getState();
        expect(_.keys(state.todo.find).length).to.equal(0);
        expect(_.keys(state.todo.byId).length).to.equal(1);
        expect(_.keys(state.todo.byCid).length).to.equal(1);

        // Just for fun, let's verify the id actually exists
        var realTodo = state.todo.byCid[optimisticTodo.cid];
        expect(realTodo.id).to.exist;
        done();
      }, TEST_DELAY));
    });
  });

  describe('action-reducer flow: actions.todo.find() [id as String]', function() {

    beforeEach(function() {
      nock('https://api.example.com')
        .persist()
        .get('/todos')
        .reply(200, [
          {
            id: '1',
            title: 'foo'
          }
        ]);
    });

    it("should find the todos and add them to the store", function(done) {
      lore.build(config);
      var optimisticTodos = lore.actions.todo.find().payload;

      // We should have one query dictionary created, but it should have no data
      var state = lore.store.getState();
      expect(_.keys(state.todo.find).length).to.equal(1);
      expect(_.keys(state.todo.byId).length).to.equal(0);
      expect(_.keys(state.todo.byCid).length).to.equal(0);
      expect(state.todo.find['{"where":{}}'].data.length).to.equal(0);

      // Subscribe to the store so we can be notified once the server response
      // comes back with the real data

      lore.store.subscribe(_.debounce(function () {

        // The second time we check state we should see the models returned
        // from the server
        state = lore.store.getState();
        expect(_.keys(state.todo.find).length).to.equal(1);
        expect(_.keys(state.todo.byId).length).to.equal(1);
        expect(_.keys(state.todo.byCid).length).to.equal(1);
        expect(state.todo.find['{"where":{}}'].data.length).to.equal(1);

        done();
      }, TEST_DELAY));
    });
  });

  describe('action-reducer flow: actions.todo.get() [id as String]', function() {

    beforeEach(function() {
      nock('https://api.example.com')
        .persist()
        .get('/todos/1')
        .reply(200, {
          id: '1',
          title: 'foo'
        });
    });

    it("should create a todo, add it to the store, and update it when the server responds", function(done) {
      lore.build(config);
      var optimisticTodo = lore.actions.todo.get('1').payload;

      // Because we're specifying the id, it should be in two reducers
      var state = lore.store.getState();
      expect(_.keys(state.todo.find).length).to.equal(0);
      expect(_.keys(state.todo.byId).length).to.equal(1);
      expect(_.keys(state.todo.byCid).length).to.equal(1);

      // Subscribe to the store so we can be notified once the server response
      // comes back with the real data
      lore.store.subscribe(_.debounce(function () {

        // The second time we check state we should see the models returned
        // from the server
        state = lore.store.getState();
        expect(_.keys(state.todo.find).length).to.equal(0);
        expect(_.keys(state.todo.byId).length).to.equal(1);
        expect(_.keys(state.todo.byCid).length).to.equal(1);

        // We should have the title in the store now if the server truly responded
        var realTodo = state.todo.byId['1'];
        expect(realTodo.data.title).to.equal('foo');

        done();
      }, TEST_DELAY));

    });
  });

  describe('action-reducer flow: actions.todo.update() [id as String]', function() {

    beforeEach(function() {
      nock('https://api.example.com')
        .persist()
        .put('/todos/1')
        .reply(200, {
          id: '1',
          title: 'bar'
        });
    });

    it("should udpate the todo and update it in the store", function(done) {
      lore.build(config);
      var store = lore.store;
      var data = populateStore(store, {
        todo: [{
          id: '1',
          cid: 'c1',
          title: 'foo'
        }]
      });
      var todo = data.todo[0];

      var optimisticUpdatedTodo = lore.actions.todo.update(todo, {
        title: 'baz'
      }).payload;

      // Because we're specifying the id, it should be in two reducers
      var state = store.getState();
      expect(_.keys(state.todo.find).length).to.equal(0);
      expect(_.keys(state.todo.byId).length).to.equal(1);
      expect(_.keys(state.todo.byCid).length).to.equal(1);
      expect(state.todo.byId[todo.id].data.title).to.equal(optimisticUpdatedTodo.data.title);

      // Subscribe to the store so we can be notified once the server response
      // comes back with the real data
      store.subscribe(_.debounce(function () {

        // The second time we check state we should see the models returned
        // from the server
        state = store.getState();
        expect(_.keys(state.todo.find).length).to.equal(0);
        expect(_.keys(state.todo.byId).length).to.equal(1);
        expect(_.keys(state.todo.byCid).length).to.equal(1);

        // We should have the title in the store now if the server truly responded
        var realTodo = state.todo.byId['1'];
        expect(realTodo.data.title).to.equal('bar');

        done();
      }, TEST_DELAY));
    });
  });

  describe('action-reducer flow: actions.todo.destroy() [id as String]', function() {

    beforeEach(function() {
      nock('https://api.example.com')
        .persist()
        .delete('/todos/1')
        .reply(200);
    });

    it("should delete a todo and remove it from the store", function(done) {
      lore.build(config);
      var store = lore.store;
      var data = populateStore(store, {
        todo: [{
          id: '1',
          cid: 'c1',
          title: 'foo'
        }]
      });
      var todo = data.todo[0];

      var optimisticDestroyedTodo = lore.actions.todo.destroy(todo).payload;

      // Because we're specifying the id, it should be in two reducers
      var state = store.getState();
      expect(_.keys(state.todo.find).length).to.equal(0);
      expect(_.keys(state.todo.byId).length).to.equal(1);
      expect(_.keys(state.todo.byCid).length).to.equal(1);

      // Subscribe to the store so we can be notified once the server confirms
      // the request
      store.subscribe(_.debounce(function () {

        // The second time we check state the delete request will have completed
        // and the model should have been removed from the store
        state = store.getState();

        expect(_.keys(state.todo.find).length).to.equal(0);
        expect(_.keys(state.todo.byId).length).to.equal(0);
        expect(_.keys(state.todo.byCid).length).to.equal(0);

        done();
      }, TEST_DELAY));
    });
  });

  /**
   * Repeat the tests, but using a Number for the unique id
   */

  describe('action-reducer flow: actions.todo.create() [id as Number]', function() {

    beforeEach(function() {
      nock('https://api.example.com')
        .persist()
        .post('/todos')
        .reply(201, {
          id: 1,
          title: 'foo'
        });
    });

    it("should create a todo and add it to the store", function(done) {
      lore.build(config);
      var optimisticTodo = lore.actions.todo.create({
        title: 'foo'
      }).payload;

      // The first time we check state we should see the optimistic response
      var state = lore.store.getState();
      expect(_.keys(state.todo.find).length).to.equal(0);
      expect(_.keys(state.todo.byId).length).to.equal(0);
      expect(_.keys(state.todo.byCid).length).to.equal(1);


      // Subscribe to the store so we can be notified once the server response
      // comes back with the real data
      lore.store.subscribe(_.debounce(function () {

        // The second time we check state we should see the real model
        state = lore.store.getState();
        expect(_.keys(state.todo.find).length).to.equal(0);
        expect(_.keys(state.todo.byId).length).to.equal(1);
        expect(_.keys(state.todo.byCid).length).to.equal(1);

        // Just for fun, let's verify the id actually exists
        var realTodo = state.todo.byCid[optimisticTodo.cid];
        expect(realTodo.id).to.exist;
        done();
      }, TEST_DELAY));
    });
  });

  describe('action-reducer flow: actions.todo.find() [id as Number]', function() {

    beforeEach(function() {
      nock('https://api.example.com')
        .persist()
        .get('/todos')
        .reply(200, [
          {
            id: 1,
            title: 'foo'
          }
        ]);
    });

    it("should find the todos and add them to the store", function(done) {
      lore.build(config);
      var optimisticTodos = lore.actions.todo.find().payload;

      // We should have one query dictionary created, but it should have no data
      var state = lore.store.getState();
      expect(_.keys(state.todo.find).length).to.equal(1);
      expect(_.keys(state.todo.byId).length).to.equal(0);
      expect(_.keys(state.todo.byCid).length).to.equal(0);
      expect(state.todo.find['{"where":{}}'].data.length).to.equal(0);

      // Subscribe to the store so we can be notified once the server response
      // comes back with the real data
      lore.store.subscribe(_.debounce(function () {

        // The second time we check state we should see the models returned
        // from the server
        state = lore.store.getState();
        expect(_.keys(state.todo.find).length).to.equal(1);
        expect(_.keys(state.todo.byId).length).to.equal(1);
        expect(_.keys(state.todo.byCid).length).to.equal(1);
        expect(state.todo.find['{"where":{}}'].data.length).to.equal(1);

        done();
      }, TEST_DELAY));
    });
  });

  describe('action-reducer flow: actions.todo.get() [id as Number]', function() {

    beforeEach(function() {
      nock('https://api.example.com')
        .persist()
        .get('/todos/1')
        .reply(200, {
          id: 1,
          title: 'foo'
        });
    });

    it("should create a todo, add it to the store, and update it when the server responds", function(done) {
      lore.build(config);
      var optimisticTodo = lore.actions.todo.get(1).payload;

      // Because we're specifying the id, it should be in two reducers
      var state = lore.store.getState();
      expect(_.keys(state.todo.find).length).to.equal(0);
      expect(_.keys(state.todo.byId).length).to.equal(1);
      expect(_.keys(state.todo.byCid).length).to.equal(1);

      // Subscribe to the store so we can be notified once the server response
      // comes back with the real data
      lore.store.subscribe(_.debounce(function () {

        // The second time we check state we should see the models returned
        // from the server
        state = lore.store.getState();
        expect(_.keys(state.todo.find).length).to.equal(0);
        expect(_.keys(state.todo.byId).length).to.equal(1);
        expect(_.keys(state.todo.byCid).length).to.equal(1);

        // We should have the title in the store now if the server truly responded
        var realTodo = state.todo.byId[1];
        expect(realTodo.data.title).to.equal('foo');

        done();
      }, TEST_DELAY));
    });
  });

  describe('action-reducer flow: actions.todo.update() [id as Number]', function() {

    beforeEach(function() {
      nock('https://api.example.com')
        .persist()
        .put('/todos/1')
        .reply(200, {
          id: 1,
          title: 'bar'
        });
    });

    it("should udpate the todo and update it in the store", function(done) {
      lore.build(config);
      var store = lore.store;
      var data = populateStore(store, {
        todo: [{
          id: 1,
          cid: 'c1',
          title: 'foo'
        }]
      });
      var todo = data.todo[0];

      var optimisticUpdatedTodo = lore.actions.todo.update(todo, {
        title: 'baz'
      }).payload;

      // Because we're specifying the id, it should be in two reducers
      var state = store.getState();
      expect(_.keys(state.todo.find).length).to.equal(0);
      expect(_.keys(state.todo.byId).length).to.equal(1);
      expect(_.keys(state.todo.byCid).length).to.equal(1);
      expect(state.todo.byId[todo.id].data.title).to.equal(optimisticUpdatedTodo.data.title);

      // Subscribe to the store so we can be notified once the server response
      // comes back with the real data
      store.subscribe(_.debounce(function () {

        // The second time we check state we should see the models returned
        // from the server
        state = store.getState();
        expect(_.keys(state.todo.find).length).to.equal(0);
        expect(_.keys(state.todo.byId).length).to.equal(1);
        expect(_.keys(state.todo.byCid).length).to.equal(1);

        // We should have the title in the store now if the server truly responded
        var realTodo = state.todo.byId['1'];
        expect(realTodo.data.title).to.equal('bar');

        done();
      }, TEST_DELAY));
    });
  });

  describe('action-reducer flow: actions.todo.destroy() [id as Number]', function() {

    beforeEach(function() {
      nock('https://api.example.com')
        .persist()
        .delete('/todos/1')
        .reply(200);
    });

    it("should delete a todo and remove it from the store", function(done) {
      lore.build(config);
      var store = lore.store;
      var data = populateStore(store, {
        todo: [{
          id: 1,
          cid: 'c1',
          title: 'foo'
        }]
      });
      var todo = data.todo[0];

      var optimisticDestroyedTodo = lore.actions.todo.destroy(todo).payload;

      // Because we're specifying the id, it should be in two reducers
      var state = store.getState();
      expect(_.keys(state.todo.find).length).to.equal(0);
      expect(_.keys(state.todo.byId).length).to.equal(1);
      expect(_.keys(state.todo.byCid).length).to.equal(1);

      // Subscribe to the store so we can be notified once the server confirms
      // the request
      store.subscribe(_.debounce(function () {

        // The second time we check state the delete request will have completed
        // and the model should have been removed from the store
        state = store.getState();

        expect(_.keys(state.todo.find).length).to.equal(0);
        expect(_.keys(state.todo.byId).length).to.equal(0);
        expect(_.keys(state.todo.byCid).length).to.equal(0);

        done();
      }, TEST_DELAY));
    });
  });

});

