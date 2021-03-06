// miniprogram/pages/zealotime/zealotime.js
//获取应用实例
const app = getApp()

// 引入SDK核心类
var QQMapWX = require('../../utils/qqmap-wx-jssdk.js');
// 实例化API核心类 地图逆坐标解析使用
var qqmapsdk = new QQMapWX({
  key: 'R' // 必填
})

Page({

  /**
   * Page initial data
   */
  data: {
    motto: '人人为我 我为人人 众志成城 数据战疫',
    userInfo: {},
    userPrivacyGroup: 1, //程序内部隐私级别规范 1:A级，2:B级，3:C级，7:D级
    userZriskLevel: 0, //用户感染风险等级 0低风险，1中等风险，2疑似，3确诊

    myScanFlag: 0,
    Z5kmVirusCount: '读取中', //云端查询5公里病毒痕迹条数
    myZcount: undefined, //Default undefined for showing low risk
    myZscanResult: [], //Data cache servers both result table and Map markers
    myLocalCount: '读取中',

    myTimeSlotUTC: 886886886886,
    myIntervalSize: 600000, //Every 10min is 600000
    latitude: 0,
    longitude: 0,
    speed: 0,
    accuracy: 0,
    //myLocationHistory: [], //[ [t1,latitude1,longitude1],[t2,la2,lo2],...,[] ]
    //userBluetooth: '____',

    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    showDialog: false,
    //markers: [{
    //  title: date,
    //  latitude: 23.099994,
    //  longitude: 113.344520,
    //  iconPath: '../../images/location.png'
    //}, {
    //  latitude: 23.099994,
    //  longitude: 113.304520,
    //  iconPath: '../../images/location.png'
    //}],
  },


  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    let self = this
    if (self.data.userInfo.nickName) {
      wx.showToast({
        icon: 'loading',
        title: '欢迎回来' + self.data.userInfo.nickName,
      })
    } else if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
      wx.showToast({
        icon: 'loading',
        title: '欢迎回来' + self.data.userInfo.nickName,
      })
    } else if (this.data.canIUse) {
      wx.showToast({
        icon: 'loading',
        title: '校验登录信息中',
        duration: 2000,
      })
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
    let self = this
    //Firstime in recording user location
    self.myGetLocationNow() //Have set 8000 for getLocation work well   
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {
    let self = this
    //reset scan result status for next correct show
    self.setData({
      myZscanResult: [],
      myZcount: undefined,
      myScanFlag: 0,
      Z5kmVirusCount: '刷新中'
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
    //console.log(e)
    app.globalData.userInfo = e.detail.userInfo
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  },

  myGetLocationNow: function () {
    self = this
    //var myTimeSlotUTC = self.data.myIntervalSize * Math.floor(Date.now() / self.data.myIntervalSize)
    var myTimeSlotUTC = Date.now() //Using database at last. I decide to use exact time finally and not to eschew two more calls of if clause
    //Get user location
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: 'true',
      highAccuracyExpireTime: '8000', //[定位硬件工作时长]at least 3000 for performance

      success(res) {
        console.log("Get location success: ", res)
        //Get 5km risk query every time location updates
        self.onQuery5km(res.longitude, res.latitude)
        //Record time slot and location
        //var myLocationHistory = self.data.myLocationHistory
        //console.log(myLocationHistory)
        //myLocationHistory.push([myTimeSlotUTC, res.latitude, res.longitude, res.speed])

        //Record time slot and location to local storage
        wx.setStorage({
          key: String(myTimeSlotUTC),
          data: [res.latitude, res.longitude, res.speed, res.accuracy],
          success: function (res) { console.log("Success in Storage", res) },
          fail: function (res) { console.log("Failed in Storage", res) },
          complete: function (res) { },
        })
        //Record time slot and location to local temp storage for runtime status
        self.setData({
          myTimeSlotUTC: myTimeSlotUTC,
          latitude: res.latitude,
          longitude: res.longitude,
          speed: res.speed,
          accuracy: res.accuracy,
          //myLocationHistory: myLocationHistory,
          //provider:provider, //gps, wifi, ble
          myLocalCount: wx.getStorageInfoSync().keys.length //Remember to call this after setStorage
        })
      }
    })
  },

  //Upload one record a time to cloud:database:collection
  showAddPopup() {
    let self = this;
    wx.showModal({
      title: '上报记录',
      content: '我们鼓励每个有新型冠状病毒感染症状的用户第一时间上报个人记录。上报记录绝非儿戏，虚报数据将带来严重后果，点击上报按钮前请务必慎重判断！',
      success(res) {
        if (res.confirm) {
          console.log('用户点击确定')
          self.myAddReport();
        } else if (res.cancel) {
          console.log('用户点击取消')
        }
      }
    })
  },

  async myAddReport() {
    let self = this
    var myStorageKeys = wx.getStorageInfoSync().keys
    //console.log("myStorageKeys", key)

    for (var key of myStorageKeys) {
      //console.log("hey", key)
      var myLocalRecord = wx.getStorageSync(key)
      //console.log("myLocalRecord",myLocalRecord[0])
      /*--Attention-------CLOUD DATABASE COLLECT TABLE STRCTURE DESIGN BLOCK HERE------注意-------*/
      const db = wx.cloud.database()
      db.collection('IPO_z_reports').add({
        data: {
          ZTimeSlotUTC: Number(key), //The time slot var name changed to ZTimeSlotUTC while uploading to cloud
          location: {
            type: 'Point',
            coordinates: [myLocalRecord[1], myLocalRecord[0]]
          },
          //latitude: myLocalRecord[0],
          //longitude: myLocalRecord[1],
          speed: myLocalRecord[2],
          accuracy: myLocalRecord[3],
          //--Basic personalized info--Will have a seperate table--//
          Zquestionnaire: self.data.myQuestionnaire,
          userZriskLevel: self.data.userZriskLevel,
          userInfo: self.data.userInfo,
          userPrivacyGroup: self.data.userPrivacyGroup
        },
        /*--Attention END----CLOUD DATABASE COLLECT TABLE STRCTURE DESIGN BLOCK HERE------注意-------*/
        success: res => {
          // 在返回结果中会包含新创建的记录的 _id
          this.setData({
            counterId: res._id,
            count: 1
          })
          wx.showToast({
            icon: 'success',
            title: '上报记录成功',
          })
          console.log('[数据库] [新增记录] 成功，记录 _id: ', res._id)
        },
        fail: err => {
          wx.showToast({
            icon: 'none',
            title: '上报未成功'
          })
          console.error('[数据库] [新增记录] 失败：', err)
        }
      })
      await self.myDelay(500)
    }
  },

  /*--------Scanning Functions--------*/
  async myScanReport() {
    //async: false
    wx.showToast({
      title: '扫描中，请等待',
      duration: 5000,
      icon: 'loading'
    })
    let self = this
    var myZscanResult = self.data.myZscanResult
    //reset scan result
    self.setData({
      myZscanResult: [],
      myZcount: undefined,
      myScanFlag: 0,
      Z5kmVirusCount: '刷新中'
    })

    self.onQuery5km(self.data.longitude, self.data.latitude)
    await self.onQueryBulk()
    await self.myDelay(5000)

    self.setData({
      myScanFlag: 1,
    })
    console.log("myZcount, myZscanResult.length:", self.data.myZcount, self.data.myZscanResult.length)  //Get statistics of this scan results
  },

  async onQueryBulk() {
    //async: false
    let self = this
    var myStorageKeys = wx.getStorageInfoSync().keys
    //console.log("myStorageKeys", key)
    for (var key of myStorageKeys) {
      //console.log("hey", key)
      var myLocalRecord = wx.getStorageSync(key)
      //console.log("myLocalRecord",myLocalRecord[0])
      await self.onQuery(Number(key), myLocalRecord[1], myLocalRecord[0]) //time,longitude,latitude
    }
    await self.myDelay(1000)
    console.log("Success in QueryBulk", self.data.myZscanResult.length)
  },

  async onQuery(ti, lo, la) {
    //async: false
    let self = this
    const db = wx.cloud.database()
    const dbcmd = db.command
    var myZscanResult = self.data.myZscanResult
    var myZcount = self.data.myZcount
    //console.log("Scanning cloud database for local record: ",ti,lo,la)

    await db.collection('IPO_z_reports').where({
      //_openid: this.data.openid
      location: dbcmd.geoNear({
        geometry: db.Geo.Point(lo, la),
        minDistance: 0,
        maxDistance: 5 //[设置][距离条件] Records in 5 meters distance 
      }),
      ZTimeSlotUTC: dbcmd.gte(ti - self.data.myIntervalSize).and(dbcmd.lte(ti + self.data.myIntervalSize)) //[设置][时间条件] Records in approximatedly 10 minutes time slot
      //Note: In the before slot of 10 minutes, risk confidence is high; while in the after slot of 10 minutes risk confidence is low, and may cause duplicate results with the before slot of the next 10 minutes if user location did not change. 
    })//.skip(50) //Use for paging
      .get({
        async success(res) {
          //Save scan results from cloud to local cache
          for (var item of res.data) {
            var tmp = {}
            //tmp.title = String(item.ZTimeSlotUTC)
            tmp.title = new Date(item.ZTimeSlotUTC).toLocaleDateString()
            tmp.longitude = item.location.longitude
            tmp.latitude = item.location.latitude
            tmp.iconPath = '../../images/location.png'
            //console.log("外部START", item.ZTimeSlotUTC)
            //Get readable address and save to cache 异步函数控制不了！！！！！！！
            qqmapsdk.reverseGeocoder({
              location: item.location, //'39.984060,116.307520'
              success: res => {
                //console.log("[QQ Map reverser Geo] 成功:", item.ZTimeSlotUTC,res)
                tmp.address = (res.result.formatted_addresses && res.result.formatted_addresses.recommend || res.result.address)
              }, //国外地址不返回formatted_addresses.recommend，直接跨级取值会报错
              fail: err => {
                //console.log('[QQ Map reverser Geo] 失败：', err) 
              }
            })
            await self.myDelay(200 + 2888 * Math.random()) /*==OMG it worked! I almost burst into tears! Lunch in nobu today===*/
            //console.log("外部END", item.ZTimeSlotUTC)
            myZscanResult.push(tmp) //Caution: need to use HASH here but so hard to find out how
          }
          await self.myDelay(222 + 2020 * Math.random())
          myZcount = myZcount + myZscanResult.length || myZscanResult.length //Avoid undefined+number=NaN

          self.setData({
            myZcount: myZcount,
            myZscanResult: myZscanResult
          })
          console.log('[数据库] [查询记录] 成功: ', myZscanResult.length)
          //console.log('[数据库] [查询记录] 成功: ', res.data)
        },
        fail: err => {
          wx.showToast({
            icon: 'none',
            title: '本次查询未成功'
          })
          console.error('[数据库] [查询记录] 失败：', err)
        }
      })
    console.log("Success in Query")
  },

  myDelay: function (milSec) {
    return new Promise(resolve => {
      setTimeout(resolve, milSec)
    })
  },

  async onQuery5km(lo, la) {
    //async: false
    let self = this
    const db = wx.cloud.database()
    const dbcmd = db.command
    var Z5kmVirusCount
    console.log("Scanning cloud database for local record 5km: ", lo, la)

    await db.collection('IPO_z_reports').where({
      location: dbcmd.geoNear({
        geometry: db.Geo.Point(lo, la),
        minDistance: 0,
        maxDistance: 5000, //[设置][距离条件] Records in 5km meters distance 
      }),
    })//.limit(20) //小程序限制每次最多取 20 条记录
      //.skip(20) //跳过多少条用于分页显示控制
      .get({
        success: res => {
          if (res.data.length == 20) {
            Z5kmVirusCount = "大于19";
            //console.log("--------------->>", res.data)
          } else { Z5kmVirusCount = res.data.length }
          self.setData({
            Z5kmVirusCount: Z5kmVirusCount
          })
          //console.log('[数据库] [查询记录5km] 成功: ', lo,la,"[resdata]:",self.data.Z5kmVirusCount)
          //console.log('[数据库] [查询记录5km] 成功: ', res)
        },
        fail: err => {
          wx.showToast({
            icon: 'none',
            title: '本次5km查询未成功'
          })
          console.error('[数据库] [查询记录5km] 失败：', err)
        }
      })
    //.count() //geo不让用count 真是 疼
  },


  /*closeDialog: function () {
    this.setData({
      istrue: false
    })
  }*/

})
