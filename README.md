# <img src="./public/logo_dark.png" width=42 /> TheOpenPresenter

**TheOpenPresenter** is an ambitious project aiming to be the final presenter software you'll ever need.
It achieves this through its modular architecture, allowing for endless customization and feature based on every specific needs.

## This project is under development 🏗️

At this current time, you will not see anything substantial here. However, this README will serve as a document to align the goals and vision of the project.

## Goals

### 1. Web-based

Most, if not all of the projection software available today is distributed as an app. With the way technology are progressing today, there is no reason why it can't be a simple web page.

An event organizer should be able to open a link and start presenting right away. Think Google slides, but much more powerful.

### 2. Cloud powered & Collaborative

One desirable feature from software available today is collaboration. Imagine again Google slides. You can work on the same slide at the same time. Why not have the same here? 

Someone could prepare the announcements slides while the other prepare the lyrics and so on.

Or if it's a multi-day event, you could prepare everything in advance directly in TheOpenPresenter. On the day, all you need to do is open the webpage.

### 3. Available as a local app

With that in mind, not every venue has access to internet. And even if they do, it's not always reliable. So TheOpenPresenter should also be available as a local app. Syncing to the cloud when possible.

### 4. Modular & Powerful

Most feature should be available as plugins. There are so many use-cases for a presentation software. We can't possibly do them all here. Instead, we try to be as modular as possible so that plugin developers can extend it to fit their use case.

### 5. Focused

TheOpenPresenter is first and foremost designed to be used in a church setting. As such, it needs to be suited to that use case. It should also be easy to use and volunteer friendly.

The modular approach of this project should complement this goal by only showing as much as needed for each church's use-case.

## Note: Work in Progress

Many of the things written below this point is not built. They are written as a design document for what is to come.

## Core Architecture

### 1. Server

The server is the core piece of architecture that is responsible for orchestrating many of the functionality in TheOpenPresenter.  
Briefly, it's responsibilities consists of:  
- Connecting the clients together (remote, renderer)
- Storing rendering state
- Plugin Database
- Plugin Media storage

#### Server as a service

The server is available as a cloud service, allowing TheOpenPresenter to be used with ease.  
Additionally, you can self-host the server by running a few simple commands in any linux box.

#### Server as a local app

Alternatively, the server is also available as a local app. This is the preferred method for locations with unreliable or no internet connection. 

In this configuration, you can download and install an app that will handle everything, just like how other presentation software is designed.

#### State

In TheOpenPresenter, we use the abstraction of "project" to represent everything you'd need within the app. For example, you'd have a "Sunday Morning" project.

Any data relating to a project is encapsulated within what we call "state".  
The state object holds: 
- The configuration of the presentation. Eg: Slides, link to videos, etc.
- Instruction on how the renderer should render the data

The state is passed around to every piece of architecture and is the main driving force of the whole application.

#### Plugin System

TheOpenPresenter uses a plugin system and relies on it to do most of its functionalities. Plugins provide logic to the server, along with the Remote and Renderer documented below.

To facilitate that, we provide an API that allows it to query most of the state of the presentation, along with some mechanism to do its job well.

##### Database

TheOpenPresenter allows plugins to access a database instance to store any kind of data. This is achieved through creating a database schema in its own internal database.

##### Media Storage

Additionally, plugins can use the API provided to store media directly in TheOpenPresenter. 

Some plugins may also provide different medium of storage. Eg: Local, S3, and more.

### 2. Remote

The remote is a client-side piece of architecture that is used to manipulate the state of the presenter.  
In other words, this is the UI to control the app. 

This is the simplest part of the architecture. Yet, it is very important as this is what the operator uses to do anything at all.

### 3. Renderer

The renderer is architecture that renders the state into the final picture/result.

There are multiple ways to render the final result.
- Using the browser of the renderer machine.
- In the server

#### 3a. Browser rendering

Browser rendering is the default rendering method. It is the simplest and the recommended way for anything simple. 

##### Media cache

Since rendering is done in this part, we use media cache to ensure smooth media playback and transition.
If there are multiple renderer connected, each of them will need a cache of their own.

#### 3b. Server rendering

Server rendering renders the final picture in the server. This is required if we want an output in a specific format.  
For example: Video stream like NDI/SDI/HDMI/RTSP and the like.

The benefit is that there won't need to be a client. Or at least it can be a very simple client.
