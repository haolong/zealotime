// miniprogram/pages/zealotime/zealotime.js
//获取应用实例
const app = getApp()
Page({

  /**
   * Page initial data
   */
  data: {
    motto: 'Hello World',
    myZcount: 0, //Default Good
    queryResult: 'Loading...', 
    userInfo: {},
    myIntervalSize: 10000, //Every 10min is 6000000
    myLocationHistory: [], //[ [t1,latitude1,longitude1],[t2,la2,lo2],...,[] ]
    latitude: 0,
    longitude: 0,
    myTimeSlotUTC: 158000,
    //userBluetooth: '____',
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo')
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

    //Firstime in recording user location
    this.myGetLocationNow()

    //var value = wx.getStorageSync('158036260')
    //console.log("dataa2", value[0])
    
  },
  

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {
    let self = this
    //Repeat every 10 minutes in recording user location
    var myInterval = setInterval(function () {
      self.myGetLocationNow()
    }, self.data.myIntervalSize)

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

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
      highAccuracyExpireTime: '3000', //at least 3000 for performance

      success(res) {
        console.log(res)
        //Record time slot and location
        var myLocationHistory = self.data.myLocationHistory
        //console.log(myLocationHistory)
        myLocationHistory.push([myTimeSlotUTC, res.latitude, res.longitude, res.speed])
        self.setData({
          latitude: res.latitude,
          longitude: res.longitude,
          speed: res.speed,
          accuracy: res.accuracy,
          myLocationHistory: myLocationHistory
        })
        //Record time slot and location to local storage
        wx.setStorage({
          key: String(myTimeSlotUTC),
          data: [res.latitude, res.longitude, res.speed],
          success: function (res) { },
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

      const db = wx.cloud.database()
      db.collection('z_reports').add({
        data: {
          myTimeSlotUTC: Number(key),
          location: {
            type: 'Point',
            coordinates: [myLocalRecord[1], myLocalRecord[0], myLocalRecord[2]]
          }
          //latitude: myLocalRecord[0],
          //longitude: myLocalRecord[1],
          //speed:     myLocalRecord[2]
        },
        success: res => {
          // 在返回结果中会包含新创建的记录的 _id
          this.setData({
            counterId: res._id,
            count: 1
          })
          wx.showToast({
            title: '新增记录成功',
          })
          console.log('[数据库] [新增记录] 成功，记录 _id: ', res._id)
        },
        fail: err => {
          wx.showToast({
            icon: 'none',
            title: '新增记录失败'
          })
          console.error('[数据库] [新增记录] 失败：', err)
        }
      })
    }
  },

  myScanReport: function(){
    var myStorageKeys = wx.getStorageInfoSync().keys
    //console.log("myStorageKeys", key)

    for (var key of myStorageKeys) {
      //console.log("hey", key)
      var myLocalRecord = wx.getStorageSync(key)
      //console.log("myLocalRecord",myLocalRecord[0])
      this.onQuery(Number(key),myLocalRecord[1], myLocalRecord[0])
    }
  },

  onQuery: function (ti,lo,la) {
    const db = wx.cloud.database()
    const dbcmd = db.command

    console.log(ti,lo,la)

    db.collection('z_reports').where({
      //_openid: this.data.openid
      location: dbcmd.geoNear({
        geometry: db.Geo.Point(lo, la),
        minDistance: 0,
        maxDistance: 5, //Records in 5 meters distance
      }),
      myTimeSlotUTC: dbcmd.gte(ti-100).and(dbcmd.lte(ti+100)) //Records in approximatedly 10 minutes time slot 
    }).get({
      success: res => {
        this.setData({
          queryResult: res.data,
          myZcount: res.data.length  //注意：需要累加
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
  }


})
