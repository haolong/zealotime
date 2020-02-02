// miniprogram/pages/zealotime/zealotime.js
//获取应用实例
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    motto: '人人为我 我为人人 众志成城 数据战疫',
    myZcount: -1, //Default -1 for good. Avoid showing 0 alert and >1 result blocks
    myZscanResult: [], //Want to use hash table here
    myLocalCount: '读取中',
    userInfo: {},
    myIntervalSize: 600000, //Every 10min is 600000
    myLocationHistory: [], //[ [t1,latitude1,longitude1],[t2,la2,lo2],...,[] ]
    latitude: 0,
    longitude: 0,
    speed:0,
    accuracy:0,
    myTimeSlotUTC: 888888,
    //userBluetooth: '____',
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    showDialog: false,
    covers: [{
      latitude: 23.099994,
      longitude: 113.344520,
      iconPath: '../../images/location.png'
    }, {
      latitude: 23.099994,
      longitude: 113.304520,
      iconPath: '../../images/location.png'
    }]
  },

  
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    let self = this
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
    } else if (this.data.canIUse) {
      // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
      // 所以此处加入 callback 以防止这种情况
      app.userInfoReadyCallback = res => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    } else {
      // 在没有 open-type=getUserInfo 版本的兼容处理
      wx.getUserInfo({
        success: res => {
          app.globalData.userInfo = res.userInfo
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          })
        }
      })
    }

  },
  

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {
    //Repeat every 10 minutes in recording user location
    var myInterval = setInterval(function () {
      self.myGetLocationNow()
    }, self.data.myIntervalSize)
  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {
    let self = this
    //Firstime in recording user location
    self.myGetLocationNow()

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {
    let self = this
    self.setData({
      myZscanResult: [],
      myZcount: -1 //Avoid showing 0 alert and >1 result blocks
    })
  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  },

  
  getUserInfo: function (e) {
    console.log(e)
    app.globalData.userInfo = e.detail.userInfo
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  },

  myGetLocationNow: function () {
    self = this
    var myTimeSlotUTC = Math.floor(Date.now() / self.data.myIntervalSize)
    //Get user location
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: 'true',
      highAccuracyExpireTime: '10000', //[定位硬件工作时长]at least 3000 for performance

      success(res) {
        console.log(res)
        //Record time slot and location
        var myLocationHistory = self.data.myLocationHistory
        //console.log(myLocationHistory)
        myLocationHistory.push([myTimeSlotUTC, res.latitude, res.longitude, res.speed])
        self.setData({
          myTimeSlotUTC: myTimeSlotUTC,
          latitude: res.latitude,
          longitude: res.longitude,
          speed: res.speed,
          accuracy: res.accuracy,
          myLocationHistory: myLocationHistory,
          myLocalCount: wx.getStorageInfoSync().keys.length
        })
        //Record time slot and location to local storage
        wx.setStorage({
          key: String(myTimeSlotUTC),
          data: [res.latitude, res.longitude, res.speed, res.accuracy],
          success: function (res) { console.log("Success in Storage", res) },
          fail: function (res) { console.log("Failed in Storage", res) },
          complete: function (res) { },
        })
      }
    })
  },

  //Upload one record a time to cloud:database:collection
  myAddReport: function(){
    var myStorageKeys = wx.getStorageInfoSync().keys
    //console.log("myStorageKeys", key)

    for (var key of myStorageKeys) {
      //console.log("hey", key)
      var myLocalRecord = wx.getStorageSync(key)
      //console.log("myLocalRecord",myLocalRecord[0])
/*--Attention-------CLOUD DATABASE COLLECT TABLE STRCTURE DESIGN BLOCK HERE------注意-------*/
      const db = wx.cloud.database()
      db.collection('z_reports').add({
        data: {
          myTimeSlotUTC: Number(key),
          location: {
            type: 'Point',
            coordinates: [myLocalRecord[1], myLocalRecord[0]]
          },
          //latitude: myLocalRecord[0],
          //longitude: myLocalRecord[1],
          speed:     myLocalRecord[2],
          accuracy:  myLocalRecord[3]
        },
/*--Attention END----CLOUD DATABASE COLLECT TABLE STRCTURE DESIGN BLOCK HERE------注意-------*/
        success: res => {
          // 在返回结果中会包含新创建的记录的 _id
          this.setData({
            counterId: res._id,
            count: 1
          })
          wx.showToast({
            title: '上报记录成功',
          })
          console.log('[数据库] [新增记录] 成功，记录 _id: ', res._id)
        },
        fail: err => {
          wx.showToast({
            icon: 'none',
            title: '上报记录失败'
          })
          console.error('[数据库] [新增记录] 失败：', err)
        }
      })
    }
  },

  myScanReport: function(){
    //async: false
    wx.showToast({
      title: '开始扫描',
    })
    let self = this
    var myZscanResult = self.data.myZscanResult
    this.setData({
      myZscanResult: []
    })

    var myStorageKeys = wx.getStorageInfoSync().keys
    //console.log("myStorageKeys", key)
    for (var key of myStorageKeys) {
      //console.log("hey", key)
      var myLocalRecord = wx.getStorageSync(key)
      //console.log("myLocalRecord",myLocalRecord[0])
      this.onQuery(Number(key),myLocalRecord[1], myLocalRecord[0]) //time,longitude,latitude
    }
    //[HELP: Can't promise the syn 异步顺序关不掉] console.log("count:", app.globalData.myZcount, self.data.myZscanResult.length)  //Get statistics of this scan results
  },

  onQuery: function (ti,lo,la) {
    let self =  this
    const db = wx.cloud.database()
    const dbcmd = db.command
    var myZscanResult = self.data.myZscanResult
    console.log("Scanning cloud database for local record: ",ti,lo,la)

    db.collection('z_reports').where({
      //_openid: this.data.openid
      location: dbcmd.geoNear({
        geometry: db.Geo.Point(lo, la),
        minDistance: 0,
        maxDistance: 5, //[设置][距离条件] Records in 5 meters distance 
      }),
      myTimeSlotUTC: dbcmd.gte(ti - self.data.myIntervalSize).and(dbcmd.lte(ti + self.data.myIntervalSize)) //[设置][时间条件] Records in approximatedly 10 minutes time slot 
    }).get({
      success: res => {
        for(var item of res.data){
          var tmp = {}
          tmp.myTimeSlotUTC = item.myTimeSlotUTC
          tmp.longitude = item.location.longitude
          tmp.latitude = item.location.latitude
          tmp.iconPath = '../../images/location.png'
          myZscanResult.push(tmp) //Caution: need to use HASH here but so hard to find out how
        }
        self.setData({
          myZscanResult: myZscanResult,
          myZcount: res.data.length //注意：这个写法出来的结果是错的
        })
        console.log('[数据库] [查询记录] 成功: ', res.data.length)
        console.log('[数据库] [查询记录] 成功: ', res.data)
      },
      fail: err => {
        wx.showToast({
          icon: 'none',
          title: '查询记录失败'
        })
        console.error('[数据库] [查询记录] 失败：', err)
      }
    })
  },

  openDialog: function () {
    this.setData({
      istrue: true
    })
  },
  closeDialog: function () {
    this.setData({
      istrue: false
    })
  }



})
