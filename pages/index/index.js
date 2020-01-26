//index.js
//获取应用实例
const app = getApp()

Page({
  data: {
    motto: 'Hello World',
    userInfo: {},
    myLocationHistory: [], //[ [t1,latitude1,longitude1],[t2,la2,lo2],...,[] ]
    //userBluetooth: '____',
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo')
  },
  //事件处理函数
  bindViewTap: function() {
    wx.navigateTo({
      url: '../logs/logs'
    })
  },
  onLoad: function () {
    let self = this
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
    } else if (this.data.canIUse){
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

    //console.log("aa",Date.now() / 100000,Date.now() % 100000)
    //wait to a integer 10second
    while (Date.now() % 10000 != 0) { 
      //Wait
    }
    //Repeat and repeat
    var myInterval2 = setInterval(function () {
      var myTimeSlotUTC = Math.floor(Date.now() / 10000)
      //Get user location
      wx.getLocation({
        type: 'gcj02',
        isHighAccuracy: 'true',
        highAccuracyExpireTime: '3000', //at least 3000 for performance
        success(res) {
          console.log(res)
          var myLocationHistory = self.data.myLocationHistory
          //console.log(myLocationHistory)
          myLocationHistory.push([myTimeSlotUTC, res.latitude, res.longitude])
          self.setData({
            latitude: res.latitude,
            longitude: res.longitude,
            speed: res.speed,
            accuracy: res.accuracy,
            myLocationHistory: myLocationHistory
          })
          wx.setStorage({
            key: String(myTimeSlotUTC),
            data: [res.latitude, res.longitude],
            success: function(res) {},
            fail: function (res) {console.log(res)},
            complete: function(res) {},
          })
        }
      })
    },10000) //Every 10min  6000000
    //console.log("cc",Date.now() / 10000, Date.now() % 10000)

  getUserInfo: function(e) {
    console.log(e)
    app.globalData.userInfo = e.detail.userInfo
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  },
  navigateScan: function(e){
    console.log(e)
    wx.navigateTo({
      url: '../scan/scan'
    })
  }
})
