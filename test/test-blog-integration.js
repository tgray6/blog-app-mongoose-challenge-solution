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
	// console.info('seeding blog data');
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
    return runServer();
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
          res.body.should.have.length.of.at.least(1);
          return BlogPost.count();
        })
        .then(function(count) {
          res.body.should.have.lengthOf(count);
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
          res.body.should.be.a('array');
          res.body.should.have.length.of.at.least(1);

          res.body.forEach(function(blog) {
            blog.should.be.a('object');
            blog.should.include.keys(
              'id', 'title', 'content', 'author', 'created');
          });
          resBlog = res.body[0];
          return BlogPost.findById(resBlog.id);
        })
        .then(function(blog) {

          resBlog.id.should.equal(blog.id);
          resBlog.title.should.equal(blog.title);
          resBlog.content.should.equal(blog.content);
          resBlog.author.should.equal(blog.authorName);
          // resBlog.created.should.contain(blog.created);
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
          res.body.author.should.equal(`${newBlog.author.firstName} ${newBlog.author.lastName}`);
          // res.body.created.should.equal(newBlog.created);

          return BlogPost.findById(res.body.id);
        })
        .then(function(blog) {
          blog.title.should.equal(newBlog.title);
          blog.content.should.equal(newBlog.content);
          blog.author.firstName.should.equal(newBlog.author.firstName);
          blog.author.lastName.should.equal(newBlog.author.lastName);
          // blog.created.should.equal(newBlog.created);
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
        author: {
        	firstName: 'Tyler',
        	lastName: 'Gray'
        }
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
          blog.author.firstName.should.equal(updateData.author.firstName);
          blog.author.lastName.should.equal(updateData.author.lastName);
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
















// 'use strict';

// const chai = require('chai');
// const chaiHttp = require('chai-http');
// const faker = require('faker');
// const mongoose = require('mongoose');

// // this makes the should syntax available throughout
// // this module
// const should = chai.should();

// const { BlogPost } = require('../models');
// const { closeServer, runServer, app } = require('../server');
// const { TEST_DATABASE_URL } = require('../config');

// chai.use(chaiHttp);

// // this function deletes the entire database.
// // we'll call it in an `afterEach` block below
// // to ensure  ata from one test does not stick
// // around for next one
// function tearDownDb() {
//   return new Promise((resolve, reject) => {
//     console.warn('Deleting database');
//     mongoose.connection.dropDatabase()
//       .then(result => resolve(result))
//       .catch(err => reject(err));
//   });
// }


// // used to put randomish documents in db
// // so we have data to work with and assert about.
// // we use the Faker library to automatically
// // generate placeholder values for author, title, content
// // and then we insert that data into mongo
// function seedBlogPostData() {
//   console.info('seeding blog post data');
//   const seedData = [];
//   for (let i = 1; i <= 10; i++) {
//     seedData.push({
//       author: {
//         firstName: faker.name.firstName(),
//         lastName: faker.name.lastName()
//       },
//       title: faker.lorem.sentence(),
//       content: faker.lorem.text()
//     });
//   }
//   // this will return a promise
//   return BlogPost.insertMany(seedData);
// }


// describe('blog posts API resource', function () {

//   before(function () {
//     return runServer(TEST_DATABASE_URL);
//   });

//   beforeEach(function () {
//     return seedBlogPostData();
//   });

//   afterEach(function () {
//     // tear down database so we ensure no state from this test
//     // effects any coming after.
//     return tearDownDb();
//   });

//   after(function () {
//     return closeServer();
//   });

//   // note the use of nested `describe` blocks.
//   // this allows us to make clearer, more discrete tests that focus
//   // on proving something small
//   describe('GET endpoint', function () {

//     it('should return all existing posts', function () {
//       // strategy:
//       //    1. get back all posts returned by by GET request to `/posts`
//       //    2. prove res has right status, data type
//       //    3. prove the number of posts we got back is equal to number
//       //       in db.
//       let res;
//       return chai.request(app)
//         .get('/posts')
//         .then(_res => {
//           res = _res;
//           res.should.have.status(200);
//           // otherwise our db seeding didn't work
//           res.body.should.have.length.of.at.least(1);

//           return BlogPost.count();
//         })
//         .then(count => {
//           // the number of returned posts should be same
//           // as number of posts in DB
//           res.body.should.have.length.of.at.least(count);
//           // res.body.should.have.length.of(count);
//         });
//     });

//     it('should return posts with right fields', function () {
//       // Strategy: Get back all posts, and ensure they have expected keys

//       let resPost;
//       return chai.request(app)
//         .get('/posts')
//         .then(function (res) {

//           res.should.have.status(200);
//           res.should.be.json;
//           res.body.should.be.a('array');
//           res.body.should.have.length.of.at.least(1);

//           res.body.forEach(function (post) {
//             post.should.be.a('object');
//             post.should.include.keys('id', 'title', 'content', 'author', 'created');
//           });
//           // just check one of the posts that its values match with those in db
//           // and we'll assume it's true for rest
//           resPost = res.body[0];
//           return BlogPost.findById(resPost.id);
//         })
//         .then(post => {
//           resPost.title.should.equal(post.title);
//           resPost.content.should.equal(post.content);
//           resPost.author.should.equal(post.authorName);
//         });
//     });
//   });

//   describe('POST endpoint', function () {
//     // strategy: make a POST request with data,
//     // then prove that the post we get back has
//     // right keys, and that `id` is there (which means
//     // the data was inserted into db)
//     it('should add a new blog post', function () {

//       const newPost = {
//         title: faker.lorem.sentence(),
//         author: {
//           firstName: faker.name.firstName(),
//           lastName: faker.name.lastName(),
//         },
//         content: faker.lorem.text()
//       };

//       return chai.request(app)
//         .post('/posts')
//         .send(newPost)
//         .then(function (res) {
//           res.should.have.status(201);
//           res.should.be.json;
//           res.body.should.be.a('object');
//           res.body.should.include.keys(
//             'id', 'title', 'content', 'author', 'created');
//           res.body.title.should.equal(newPost.title);
//           // cause Mongo should have created id on insertion
//           res.body.id.should.not.be.null;
//           res.body.author.should.equal(
//             `${newPost.author.firstName} ${newPost.author.lastName}`);
//           res.body.content.should.equal(newPost.content);
//           return BlogPost.findById(res.body.id);
//         })
//         .then(function (post) {
//           post.title.should.equal(newPost.title);
//           post.content.should.equal(newPost.content);
//           post.author.firstName.should.equal(newPost.author.firstName);
//           post.author.lastName.should.equal(newPost.author.lastName);
//         });
//     });
//   });

//   describe('PUT endpoint', function () {

//     // strategy:
//     //  1. Get an existing post from db
//     //  2. Make a PUT request to update that post
//     //  4. Prove post in db is correctly updated
//     it('should update fields you send over', function () {
//       const updateData = {
//         title: 'cats cats cats',
//         content: 'dogs dogs dogs',
//         author: {
//           firstName: 'foo',
//           lastName: 'bar'
//         }
//       };

//       return BlogPost
//         .findOne()
//         .then(post => {
//           updateData.id = post.id;

//           return chai.request(app)
//             .put(`/posts/${post.id}`)
//             .send(updateData);
//         })
//         .then(res => {
//           res.should.have.status(204);
//           return BlogPost.findById(updateData.id);
//         })
//         .then(post => {
//           post.title.should.equal(updateData.title);
//           post.content.should.equal(updateData.content);
//           post.author.firstName.should.equal(updateData.author.firstName);
//           post.author.lastName.should.equal(updateData.author.lastName);
//         });
//     });
//   });

//   describe('DELETE endpoint', function () {
//     // strategy:
//     //  1. get a post
//     //  2. make a DELETE request for that post's id
//     //  3. assert that response has right status code
//     //  4. prove that post with the id doesn't exist in db anymore
//     it('should delete a post by id', function () {

//       let post;

//       return BlogPost
//         .findOne()
//         .then(_post => {
//           post = _post;
//           return chai.request(app).delete(`/posts/${post.id}`);
//         })
//         .then(res => {
//           res.should.have.status(204);
//           return BlogPost.findById(post.id);
//         })
//         .then(_post => {
//           // when a variable's value is null, chaining `should`
//           // doesn't work. so `_post.should.be.null` would raise
//           // an error. `should.be.null(_post)` is how we can
//           // make assertions about a null value.
//           should.not.exist(_post);
//         });
//     });
//   });
// });



// module.exports = {generateBlogData};