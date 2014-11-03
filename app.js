(function() {

    angular.module('socialStream', ['socialFilters']);

    angular.module('socialFilters', []);

    angular
        .module('socialStream')
        .directive('socialTile', ['$interval', 'Data', socialTile]);

    angular.module('socialStream')
        .factory('Data', ['$http', '$q', getData]);

    angular.module('socialFilters').filter('checkLink', function() {
        return function(input) {
            return input ? 'Read more' : '';
        };
    });

    function getData($http, $q) {
        var config = {
            facebook : {
                api : 'https://graph.facebook.com/v2.1/',
                method : 'get',
                field : '/?fields=feed.limit(',
                token : '),picture&access_token=868289199861924|Vxl0ksb_CQXd9pmwHlZWCOOgYO8&format=json',
                parse : function(info) {
                    var data = [],
                        info = info.data;

                    angular.forEach(info.feed.data, function(post) {
                        data.push(new CreatePost({
                            picture : post.picture && this.getFullSizeUrl(post.picture),
                            description : post.description || post.message,
                            time : post['created_time'],
                            link : post.link,
                            likes : post.likes && post.likes.data.length,
                            network : 'facebook',
                            comments : post.comments && post.comments.data.length,
                            userPicture :  info.picture.data.url,
                            name : post.from.name,
                            userLink : 'http://facebook.com/' + info.id
                        }));
                    }.bind(this));
                    return  data;
                },
                getFullSizeUrl : function(url) {
                    var str = '/v/',
                        strPos = url.indexOf(str);

                    function getfixUrl(url, param) {
                        url = decodeURIComponent(url).split(param + '=')[1];
                        if (url.indexOf('fbcdn-sphotos') == -1) {
                            return url.split('&')[0];
                        } else {
                            return url
                        }
                    }

                    if (~strPos) {
                        return (url.slice(0, strPos) + url.slice(url.lastIndexOf('/', url.indexOf('?')), url.lenth));
                    } else if (~url.indexOf('safe_image.php')) {
                        return getfixUrl(url, 'url');
                    } else if (~url.indexOf('app_full_proxy.php')) {
                        return getfixUrl(url, 'src');
                    } else {
                        return url;
                    }
                },
                http : function() {
                    return $http.get(this.api + this.id + this.field + this.limit + this.token);
                }
            },
            instagram : {
                api : 'https://api.instagram.com/v1/',
                param : '/media/recent/?client_id=2c6d2173ae9d41de905236e6301e5a43&count=',
                callback : '&callback=JSON_CALLBACK',
                parse : function(info) {
                    var data = [],
                        info = info.data;

                    angular.forEach(info.data, function(post) {
                        data.push(new CreatePost({
                            picture : post.images['standard_resolution'].url,
                            description : post.caption && post.caption.text,
                            time : post.caption && post.caption['created_time'] * 1000,
                            link : post.link,
                            likes : post.likes && post.likes.count,
                            network : 'instagram',
                            comments : post.comments && post.comments.count,
                            userPicture : post.user['profile_picture'],
                            name : post.user.username,
                            userLink : 'http://instagram.com/' + post.user.username
                        }));
                    });
                    return data;
                },
                http : function() {
                    var id = this.id,
                        newId = id.slice(1, id.length);
                    return id[0] === "@" ?
                        $http.jsonp(this.api + 'users/' + newId + this.param + this.limit + this.callback) :
                        $http.jsonp(this.api + 'tags/' + newId + this.param + this.limit + this.callback);

                }
            },
            twitter : {
                api : "https://api.jublo.net/codebird/1.1/",
                url : 'http://twitter.com/',
                headers : {
                    headers: {'X-Authorization': 'Bearer AAAAAAAAAAAAAAAAAAAAAKFCQQAAAAAAo1DTmMG54IKqdFUuI3kZKAYPwZs%3D959jg6MvFiprzNh0YxCjTOXazdmXzzD5KKmic2Qhh29CfExaC2'}
                },
                parse : function(info) {
                    var data = [],
                        info = info.data;

                    !info.length && (info = info.statuses);

                    angular.forEach(info, function(post) {
                        data.push(new CreatePost({
                            picture :  post.entities.media && post.entities.media[0]['media_url'],
                            description : post.text,
                            time : post['created_at'],
                            link : this.url + info[0].user.name + '/status/' + post['id_str'] ,
                            likes : post.favourite_counts,
                            network : 'twitter',
                            comments : post.comments && post.comments.count,
                            userPicture : post.user['profile_image_url'],
                            name : post.user.name,
                            userLink : this.url + post.user.name
                        }));
                    });
                    return data;
                },
                http : function() {
                    var id = this.id,
                        newId = id.slice(1, id.length);

                    return id[0] === "@" ?
                        $http.get(this.api + "statuses/user_timeline.json?id=" + newId + "&count=" + this.limit, this.headers) :
                        $http.get(this.api + "search/tweets.json?q=" + newId + "&count=" + this.limit, this.headers);
                }
            }
        };


        function CreatePost (postObj) {
            var post = postObj;

            post.description = this.getCuttingText(post.description);
            post.time = this.getTime(post.time);
            post.likes = post.likes || 0;
            post.comments = post.comments || 0;

            return post;
        }

        CreatePost.prototype.getCuttingText = function(text) {
            if (text) {
                return text.length > this.postLimit ? text.slice(0, this.postLimit) : text;
            }
        };

        CreatePost.prototype.getTime = function(time) {
            return moment(time).fromNow();
        };

        function setSocialData(urls) {
            var feeds = urls.feeds;

            CreatePost.prototype.postLimit = urls.postLimit;
            angular.forEach(Object.keys(feeds), function(key) {
                angular.extend(config[key], feeds[key]);
            });
        }

        function doReq() {
            var reqObj = {};

            angular.forEach(Object.keys(config), function(key) {
                reqObj[key] = config[key].http();
            });

            return $q.all(reqObj);
        }

        function parsing(value) {
            var posts = [];

            angular.forEach(Object.keys(config), function(key) {
                posts = posts.concat(config[key].parse(value[key]));
            });

            return posts;
        }

        return {
            doReq : doReq,
            setSocialData : setSocialData,
            parsing : parsing
        };
    }

    function socialTile($interval, Data) {
        return {
            restrict : 'E',
            templateUrl : 'social-tile.html',
            scope : {
                config : '@urls'
            },
            link : function(scope, element) {
                var config = angular.fromJson(scope.config);

                element.addClass('preload');
                Data.setSocialData(config);
                getPosts();
                $interval(getPosts, config.interval);

                function cb(values) {
                    element.removeClass('preload');
                    scope.data = Data.parsing(values);
                    cb =  function(values) {
                        scope.data = Data.parsing(values);
                    }
                }
                function getPosts() {
                    Data.doReq().then(cb);
                }
            },
            replace : true
        };
    }

})();
