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

//we need to create functions that generate random faker blog data for testing

function generateAuthor(){
	return {
	  author: {
      firstName: faker.firstName.first_name(),
      lastName: faker.lastName.last_name()
    }
    }
}

function generateTitle(){
	return{
		title: faker.title.catch_phrase_noun();
	}
}

function generateContent(){
	return{
		content: faker.content.paragraph();
	}
}

function generateDate(){
	return{
		created: faker.created.recent();
	}
}

//now we need to combine all our functions above, to generate a random blog post

function generateBlogData(){
		generateAuthor();
		generateTitle();
		generateContent();
		generateDate();
}