'use strict';

module.exports = function(app, nconf, isLoggedIn, hasUsername, isAjaxRequest) {
  var user = require('../lib/user');
  var playlist = require('../lib/playlist');

  var loadDashboard = function(req, res) {
    res.format({
      html: function() {
        playlist.getGlobal(req, function(err, playlists) {
          if (err) {
            res.redirect('/500');
          } else {
            var nextPage = parseInt(req.query.page, 10) + 1 || 1;
            var prevPage = parseInt(req.query.page, 10) - 1 || 0;
            if (prevPage < 0) {
              prevPage = 0;
            }
          }

          res.render('_dashboard', {
            playlists: playlists || [],
            currentHashPrev: '/#' + req.url.split('?')[0] + '?page=' + prevPage,
            currentHashNext: '/#' + req.url.split('?')[0] + '?page=' + nextPage,
            currentPage: parseInt(req.query.page, 10) || 0,
            facebookAppId: nconf.get('facebook_app_id'),
            analytics: nconf.get('analytics')
          });
        });
      },
      json: function() {
        res.send({
          title: 'moxboxx: dashboard',
          pageType: 'dashboard',
          background: req.session.background || nconf.get('background_default')
        });
      }
    });
  };

  app.get('/channel', function(req, res) {
    res.render('channel', {
      layout: false
    });
  });

  app.post('/facebook/login', function(req, res) {
    req.session.email = req.body.email;
    res.json({ message: 'okay' });
  });

  app.get('/dashboard', isLoggedIn, hasUsername, isAjaxRequest, function (req, res) {
    loadDashboard(req, res);
  });

  app.get('/', function (req, res) {
    if (req.session.email) {
      user.loadProfile(req, function(err, user) {
        if (user) {
          req.session.username = user.username;
          req.session.userId = user.id;
          req.session.background = user.background;
        }
        if (req.session.username) {
          res.render('index', {
            pageType: 'index',
            background: req.session.background || nconf.get('background_default'),
            facebookAppId: nconf.get('facebook_app_id'),
            analytics: nconf.get('analytics')
          });
        } else {
          res.redirect('/profile');
        }
      });
    } else {
      res.render('home', {
        pageType: 'home',
        background: nconf.get('background_default'),
        facebookAppId: nconf.get('facebook_app_id'),
        analytics: nconf.get('analytics')
      });
    }
  });

  app.get('/logout', function (req, res) {
    req.session.reset();

    res.redirect('/');
  });

  app.get('/profile', isLoggedIn, function (req, res) {
    user.loadProfile(req, function(err, user) {
      if (err) {
        res.render('profile', {
          pageType: 'profile',
          location: '',
          website: '',
          gravatar: '',
          emailStarred: false,
          background: nconf.get('background_default'),
          facebookAppId: nconf.get('facebook_app_id'),
          analytics: nconf.get('analytics')
        });
      } else {
        req.session.username = user.username;
        req.session.userId = user.id;
        req.session.background = user.background;

        res.render('profile', {
          pageType: 'profile',
          location: user.location || '',
          website: user.website || '',
          gravatar: user.gravatar || '',
          emailStarred: user.email_starred || false,
          background: user.background || nconf.get('background_default'),
          facebookAppId: nconf.get('facebook_app_id'),
          analytics: nconf.get('analytics')
        });
      }
    });
  });

  app.post('/profile', isLoggedIn, function(req, res) {
    if (!req.session.username) {
      req.session.firstVisit = true;
    } else {
      req.session.firstVisit = false;
    }
    user.saveProfile(req, function(err, user) {
      if (err) {
        res.status(500);
        res.json({ message: err.toString() });
      } else {
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.background = user.background;
        res.json({
          message: 'Profile has been updated!',
          meta: { firstVisit: req.session.firstVisit }
        });
      }
    });
  });

  app.post('/background', isLoggedIn, function(req, res) {
    user.saveBackground(req, nconf, function(err, background) {
      if (err) {
        res.redirect('/profile?error=1');
      } else {
        req.session.background = background;
        res.redirect('/profile');
      }
    });
  });

  app.post('/reset/background', isLoggedIn, function(req, res) {
    req.body.background = '';
    user.saveBackground(req, nconf, function(err, background) {
      if (err) {
        res.redirect('/profile?error=1');
      } else {
        req.session.background = '';
        res.redirect('/profile');
      }
    });
  });

  app.get('/recent', isAjaxRequest, function (req, res) {
    loadDashboard(req, res);
  });

  app.get('/user/:id', isAjaxRequest, function(req, res) {
    if (req.session.email &&
      !req.session.username) {
      res.redirect('/profile');
    } else {
      res.format({
        html: function() {
          var isOwner = false;
          var id = parseInt(req.params.id);

          var nextPage = parseInt(req.query.page, 10) + 1 || 1;
          var prevPage = parseInt(req.query.page, 10) - 1 || 0;
          if (prevPage < 0) {
            prevPage = 0;
          }

          playlist.userRecent(req, function(err, playlists) {
            if (err) {
              res.redirect('/404');
            } else {
              if (req.session && req.session.email &&
                parseInt(req.session.userId, 10) === parseInt(req.params.id, 10)) {
                isOwner = true;
              }

              res.render('_playlists_user', {
                playlists: playlists.data,
                owner: playlists.owner,
                isOwner: isOwner,
                currentHashPrev: '/#' + req.url.split('?')[0] + '?page=' + prevPage,
                currentHashNext: '/#' + req.url.split('?')[0] + '?page=' + nextPage,
                currentPage: parseInt(req.query.page, 10) || 0,
                facebookAppId: nconf.get('facebook_app_id'),
                analytics: nconf.get('analytics')
              });
            }
          });
        },
        json: function() {
          user.getUser(req, function(err, user) {
            if (!err) {
              res.send({
                title: 'moxboxx: user profile for ' + user.username,
                pageType: 'userProfile',
                background: user.background || nconf.get('background_default'),
              });
            }
          });
        }
      });
    }
  });
};
