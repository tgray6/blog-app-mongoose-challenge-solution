'use strict';

const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

// this makes the should syntax available throughout
// this module
const should = chai.should();

const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

chai.use(chaiHttp);


function seedBlogData(){
	console.info('seeding blog data');
	const seedData = [];
	for (let i=1; i<=10; i++){
		seedData.push(generateBlogData());
	}
	//returning the promise using our {BlogPost} constant MODELS.JS data,
	//{BlogPost} is at the bottom of models.js as our export.
	return BlogPost.insertMany(seedData);
}


//now we need to generate an object representing a blog post using faker.
function generateBlogData(){
	return{
		author: {
      		firstName: faker.name.firstName(),
      		lastName: faker.name.lastName()
    	},
    	title: faker.lorem.sentence(),
    	content: faker.lorem.paragraph(),
    	created: faker.date.recent()
 	};
}


//now we need to make a function to delete the entire database after each test.
function tearDownDb(){
	console.warn('Deleting Database');
	return mongoose.connection.dropDatabase();
}

describe('Blog API Resource', function() {
  // we need each of these hook functions to return a promise
  // otherwise we'd need to call a `done` callback. `runServer`,
  // `seedBlogData` and `tearDownDb` each return a promise,
  // so we return the value returned by these function calls.
  before(function() {
    // TEST_DATABASE_URL REMOVED PARAM ************
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedBlogData();
  });

  afterEach(function() {
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  });


  //GET TEST

  // note the use of nested `describe` blocks.
  // this allows us to make clearer, more discrete tests that focus
  // on proving something small
  describe('GET endpoint', function() {

    it('should return all existing blogs', function() {
      // strategy:
      //    1. get back all blogs returned by by GET request to `/posts`
      //    2. prove res has right status, data type
      //    3. prove the number of blogs we got back is equal to number
      //       in db.
      //
      // need to have access to mutate and access `res` across
      // `.then()` calls below, so declare it here so can modify in place
      let res;
      return chai.request(app)
        .get('/posts')
        .then(function(_res) {
          // so subsequent .then blocks can access resp obj.
          res = _res;
          res.should.have.status(200);
          // otherwise our db seeding didn't work
          res.body.posts.should.have.length.of.at.least(1);
          return BlogPost.count();
        })
        .then(function(count) {
          res.body.posts.should.have.length.of(count);
        });
    });

    it('should return blogs with right fields', function() {
      // Strategy: Get back all blogs, and ensure they have expected keys

      let resBlog;
      return chai.request(app)
        .get('/posts')
        .then(function(res) {
          res.should.have.status(200);
          res.should.be.json;
          res.body.posts.should.be.a('array');
          res.body.posts.should.have.length.of.at.least(1);

          res.body.posts.forEach(function(blog) {
            blog.should.be.a('object');
            blog.should.include.keys(
              'id', 'title', 'content', 'author', 'created');
          });
          resBlog = res.body.posts[0];
          return BlogPost.findById(resBlog.id);
        })
        .then(function(blog) {

          resBlog.id.should.equal(blog.id);
          resBlog.name.should.equal(blog.title);
          resBlog.cuisine.should.equal(blog.content);
          resBlog.borough.should.equal(blog.author);
          resBlog.address.should.contain(blog.created);
        });
    });
  });


//POST TEST
describe('POST endpoint', function() {
    // strategy: make a POST request with data,
    // then prove that the blog we get back has
    // right keys, and that `id` is there (which means
    // the data was inserted into db)
    it('should add a new blog', function() {

      const newBlog = generateBlogData();

      return chai.request(app)
        .post('/posts')
        .send(newBlog)
        .then(function(res) {
          res.should.have.status(201);
          res.should.be.json;
          res.body.should.be.a('object');
          res.body.should.include.keys(
            'id', 'title', 'content', 'author', 'created');
          res.body.title.should.equal(newBlog.title);
          // cause Mongo should have created id on insertion
          res.body.id.should.not.be.null;

          res.body.content.should.equal(newBlog.content);
          res.body.author.should.equal(newBlog.author);
          res.body.created.should.equal(newBlog.created);

          return BlogPost.findById(res.body.id);
        })
        .then(function(blog) {
          blog.title.should.equal(newBlog.title);
          blog.content.should.equal(newBlog.content);
          blog.author.should.equal(newBlog.author);
          blog.created.should.equal(newBlog.created);
        });
    });
  });


//PUT TEST
describe('PUT endpoint', function() {

    // strategy:
    //  1. Get an existing blog from db
    //  2. Make a PUT request to update that blog
    //  3. Prove blog returned by request contains data we sent
    //  4. Prove blog in db is correctly updated
    it('should update fields you send over', function() {
      const updateData = {
        title: 'I hope this title works',
        content: 'This is some sweet test content',
        author: 'Mario Man'
      };

      return BlogPost
        .findOne()
        .then(function(blog) {
          updateData.id = blog.id;

          // make request then inspect it to make sure it reflects
          // data we sent
          return chai.request(app)
            .put(`/posts/${blog.id}`)
            .send(updateData);
        })
        .then(function(res) {
          res.should.have.status(204);

          return BlogPost.findById(updateData.id);
        })
        .then(function(blog) {
          blog.title.should.equal(updateData.title);
          blog.content.should.equal(updateData.content);
          blog.author.should.equal(updateData.author);
        });
    });
  });


//DELETE TEST
describe('DELETE endpoint', function() {
    // strategy:
    //  1. get a blog
    //  2. make a DELETE request for that blog's id
    //  3. assert that response has right status code
    //  4. prove that blog with the id doesn't exist in db anymore
    it('delete a restaurant by id', function() {

      let blog;

      return BlogPost
        .findOne()
        .then(function(_blog) {
          blog = _blog;
          return chai.request(app).delete(`/posts/${blog.id}`);
        })
        .then(function(res) {
          res.should.have.status(204);
          return BlogPost.findById(blog.id);
        })
        .then(function(_blog) {
          // when a variable's value is null, chaining `should`
          // doesn't work. so `_restaurant.should.be.null` would raise
          // an error. `should.be.null(_restaurant)` is how we can
          // make assertions about a null value.
          should.not.exist(_blog);
        });
    });
  });
});






// module.exports = {generateBlogData};