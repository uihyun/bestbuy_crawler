var request = require('axios'),
    cheerio = require('cheerio'),
    fs = require('fs'),
    config = require('./config');
    deasync = require('deasync');

var page = config.page,
    showContents = config.showContents,
    outputType = config.outputType,
    brand = config.brand,
    product = config.product;

var posts = new Array();

function getArticle(i) {
    console.log("### start ###");
    
    var url = "https://www.bestbuy.com/site/searchpage.jsp?cp=" + i + "&id=pcat17071&st=" + brand + "%20" + product;
    console.log(url);

    request.get(url, {headers: {
        'Accept-Language': 'en-US',
        Cookie: 'intl_splash=false'
    }}).then(function (response) {
        var $ = cheerio.load(response.data);
        
        console.log("### crawling ###");
        console.log("### start phase 1 ###");

        var sync = true;
        var p = (i-1)*20;

        // write csv header
        if (outputType === 1 && p == 0) {
            fs.writeFile('store_bestbuy_' + brand + '.csv', 'seq,title,link,content,modelcode,price,rating,replycount,replydate,replybody,replywriter,replyrating,brand,site\n', 'utf-8', function (err) {
                if (err) throw err;
                console.log("### saved header ###");
            });
        }


        var sync2 = true;
        function getContents() {
            // crawl title and link
            console.log("### item " + p + " ###");
            $("h4.sku-header a" ).each(function () {
                var post = {"seq": "", "title": "", "link": "", "content": "", "modelcode": "", "price": "", "rating": "", "replycount": "", "replies": new Array()};
                var data = $(this);
        
                var link = data.attr("href");
                if (link.startsWith("/"))
                    link = data.attr("href");
                post["link"] = link;
                var title = data.text().trim().replace(/\r\n|\n|\r|\t/g,"").replace(/\"/g,"\"\"");
                post["title"] = title;

                posts[p] = post;
                sync = false;

                if (showContents) {
                    console.log(link);
                    console.log(title);
                }
                
                while(sync) {
                    deasync.sleep(100);
                }
                sync = true;

                console.log("### the number of list: " + (p + 1) + " ###");
                console.log("### start phase 2 ###");
                
                var link = post["link"];
                var sync1 = true;
                var replycountIdx = 0;
                request.get(link, {headers: {
                    'Accept-Language': 'en-US',
                    Cookie: 'intl_splash=false'
                }}).then(function (response) {                
                    var $1 = cheerio.load(response.data);
    
                    // header
                    $1("div.col-xs-8").each(function () {
                        var data = $1(this);
    
                        var modelcode = data.find("div.model.product-data span.product-data-value.body-copy").text().trim().replace(/\r\n|\n|\r|\t/g,"").replace(/\"/g,"\"\"");

                        if (modelcode.length == 0)
                            return;

                        post["modelcode"] = modelcode;
                        var rating = data.find("span.c-review-average").text().trim().replace(/\r\n|\n|\r|\t/g,"").replace(/\"/g,"\"\"");
                        post["rating"] = rating;
                        var replycount = data.find("span.c-total-reviews").text().trim().replace(/\r\n|\n|\r|\t/g,"").replace(/\"/g,"\"\"");
                        replycount = replycount.substring(replycount.indexOf("(") + 1, replycount.lastIndexOf(" ")).replace(",", "");
                        
                        replycountIdx = replycount - 1;

                        if (replycount <= 100) {
                            replycount = "0~100";
                        } else if (replycount <= 500) {
                            replycount = "100~500";
                        } else if (replycount <= 1000) {
                            replycount = "500~1000";
                        } else if (replycount <= 5000) {
                            replycount = "1000~5000";
                        } else if (replycount <= 10000) {
                            replycount = "5000~10000";
                        } else {
                            replycount = "10000~";
                        }

                        post["replycount"] = replycount;
                        var content = data.find("div.body-copy-lg").text().trim().replace(/\r\n|\n|\r|\t/g,"").replace(/\"/g,"\"\""); 
                        post["content"] = content; 

                        if (showContents) {
                            console.log(modelcode);
                            console.log(rating);
                            console.log(replycount);
                            console.log(content);
                        }
    
                        sync1 = false;
                    });
    
    
                    while(sync1) {
                        deasync.sleep(100);
                    }
                    sync1 = true;
    
                    var r = 0;
                    var offset = 0;
                    if (replycountIdx < offset)
                        offset = replycountIdx;
                    var isDone = false;
                    var replies = new Array();
                    var pageNum = 0;
                    post["replies"] = replies;
                    function getReplies(offset2) {
                        if (offset < offset2)
                            offset = offset2;

                        if (offset2 > replycountIdx)
                            pageNum = offset/20 + 2
                        else
                            pageNum = offset/20 + 1;

                        var replyLink = link.substring(0, link.indexOf(".p?")).replace("/site/", "/site/reviews/") + "?page=" + pageNum;
                        request.get(replyLink, {headers: {
                            'Accept-Language': 'en-US',
                            Cookie: 'intl_splash=false'
                        }}).then(function (response) {
                            var $2 = cheerio.load(response.data);
            
                            replies = post["replies"];
    
                            // reply
                            $2("li.review-item").each(function () {
                                var data = $2(this);
                        
                                var reply = {"replydate": "", "replybody": "", "replywriter": "", "replyrating": ""};
            
                                var date = data.find("time.submission-date").attr("title").trim();
                                var dateOcj = new Date(date);
                                var year = dateOcj.getFullYear();
                                var month = dateOcj.getMonth() + 1;
                                var day = dateOcj.getDate();
                                if (month < 10)
                                    month = "0" + month;
                                if (day < 10)
                                    day = "0" + day; 
                                date = year + "-" + month + "-" + day;
                                reply["replydate"] = date;
                                var writer = data.find("div.undefined.ugc-author").text().trim().replace(/\r\n|\n|\r|\t/g,"").replace(/\"/g,"\"\"");
                                reply["replywriter"] = writer;
                                var body = data.find("div.ugc-review-body.body-copy-lg").text().trim().replace(/\r\n|\n|\r|\t/g,"").replace(/\"/g,"\"\"");
                                reply["replybody"] = body;
                                var replyrating = data.find("span.c-review-average").text().trim().replace(/\r\n|\n|\r|\t/g,"").replace(/\"/g,"\"\"");
                                reply["replyrating"] = replyrating;
            
                                replies[r] = reply;
                                r++;
    
                                if (showContents) {
                                    console.log(date);
                                    console.log(writer);
                                    console.log(body);
                                    console.log(replyrating);
                                }
    
                                post["seq"] = brand + "_" + p + "_" + r;
                                post["replies"] = replies;
    
                                // write
                                // seq,title,link,content,modelcode,price,rating,replycount,replydate,replybody,replywriter,replyrating
                                if (outputType === 0) {
                                    // write json
                                    fs.appendFile('store_bestbuy.json',  JSON.stringify(post) + ',\n', 'utf-8', function (err) {
                                        if (err) throw err;
                                        else console.log("### saved item and reply " + r + " ###");
                                    });
                                } else if (outputType === 1) {
                                    var brandStr = brand.toUpperCase();
                                    if (brand == 'samsung')
                                        brandStr = 'Samsung';
                                    else if (brand == 'whirlpool')
                                        brandStr = 'Whirlpool';

                                    // write csv
                                    fs.appendFile('store_bestbuy_' + brand + '.csv',  '"' + post["seq"] + '","' + post["title"] + '","' + post["link"] + '","' + post["content"] + 
                                    '","' + post["modelcode"] + '","' + post["price"] + '","' + post["rating"] + '","' + post["replycount"] + '","' + reply["replydate"] + 
                                    '","' + reply["replybody"] + '","' + reply["replywriter"] + '","' + reply["replyrating"] + '","' + brandStr + '","bestbuy"\n', 'utf-8', function (err) {
                                        if (err) throw err;
                                        else console.log("### saved item and reply " + r + " ###");
                                    });
                                }
                            });
                            posts[p] = post;
            
                            if (!isDone) {
                                if (replycountIdx > offset) {
                                    offset = offset + 20;
                                    getReplies(offset);
                                } else {
                                    isDone = true;
                                    sync2 = false;
                                }
                            } 
                        }).catch(function (error) {
                            console.dir(error);
                        });
                    }
                    if (!isDone) {
                        getReplies(offset);
                    }
                    console.log("### process end ###");
                }).catch(function (error) {
                    console.dir(error);
                });
                
                while(sync2) {
                    deasync.sleep(100);
                }
                sync2 = true;

                p++;
            });
        }
        getContents();
    }).catch(function (error) {
        console.dir(error);
    });
};
// for (var i = 1; i <= page; i++) {
    getArticle(page);
// }