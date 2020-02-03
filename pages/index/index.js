// miniprogram/pages/zealotime/zealotime.js
//获取应用实例
const app = getApp()

// 引入SDK核心类
var QQMapWX = require('xxx/qqmap-wx.js');

// 实例化API核心类
var qqmapsdk = new QQMapWX({
  key: '开发密钥（key）' // 必填
});  

Page({

  /**
   * Page initial data
   */
  data: {
    motto: '人人为我 我为人人 众志成城 数据战疫',
    userInfo: {},
    userPrivacyGroup:1, //程序内部隐私级别规范 1:A级，2:B级，3:C级，7:D级
    userZriskLevel: 0, //用户感染风险等级 0低风险，1中等风险，2疑似，3确诊

    myScanFlag: 0,
    Z5kmVirusCount: 0, //云端查询5公里病毒痕迹条数
    myZcount: 0, //Default 0 for showing low risk
    myZscanResult: [], //Data cache servers both result table and Map markers
    myLocalCount: '读取中',

    myTimeSlotUTC: 886886886886,
    myIntervalSize: 600000, //Every 10min is 600000
    latitude: 0,
    longitude: 0,
    speed:0,
    accuracy:0,
    myLocationHistory: [], //[ [t1,latitude1,longitude1],[t2,la2,lo2],...,[] ]
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

    //自评问卷答案缓存
    myQuestionnaire: {
      gender: 0, //0 for female, 1 for male
      birthdate: "2020-02-02",
      q_temp: 37,
      q_fali: 0,
      q_ganke: 0,
      q_wuhanlvxing: 0,
      q_wuhan_jiechu: 0,
      q_jujixing_userSelfReport: 0, //聚集性指标 通过此处用户自评与云数据检测综合得出
      hasDoctorResult: 0
    }
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
    let self = this
    //Repeat every 10 minutes in recording user location
    var myInterval = setInterval(function () {
      self.myGetLocationNow()
      self.onQuery5km(self.data.longitude, self.data.latitude)
    }, self.data.myIntervalSize)
  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {
    let self = this
    //Firstime in recording user location
    self.myGetLocationNow()
    self.onQuery5km(self.data.longitude, self.data.latitude)
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {
    let self = this
    //reset scan results
    self.setData({
      myZscanResult: [],
      myZcount: 0, 
      myScanFlag: 0,
      Z5kmVirusCount: 0
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
    //var myTimeSlotUTC = self.data.myIntervalSize * Math.floor(Date.now() / self.data.myIntervalSize)
    var myTimeSlotUTC = Date.now() //Using database at last. I decide to use exact time finally and not to eschew two more calls of if clause
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
          myLocationHistory: myLocationHistory,
          myLocalCount: wx.getStorageInfoSync().keys.length //Remember to call this after setStorage
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
          ZTimeSlotUTC: Number(key), //The time slot var name changed to ZTimeSlotUTC while uploading to cloud
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
  /*--------Scanning Functions--------*/
  async myScanReport(){
    async: false
    wx.showToast({
      title: '开始扫描',
    })
    let self = this
    var myZscanResult = self.data.myZscanResult
    //reset scan result
    self.setData({
      myZscanResult: [],
      myZcount: 0,
      myScanFlag: 1,
      Z5kmVirusCount: '加载中'
    })

    self.onQuery5km(self.data.longitude,self.data.latitude)
    await self.onQueryBulk()
    //[HELP: Can't promise the syn 异步顺序关不掉] 
    console.log("count:", app.globalData.myZcount, self.data.myZscanResult.length)  //Get statistics of this scan results
  },

  async onQueryBulk() {
    async: false
    let self = this
    var myStorageKeys = wx.getStorageInfoSync().keys
    //console.log("myStorageKeys", key)
    for (var key of myStorageKeys) {
      //console.log("hey", key)
      var myLocalRecord = wx.getStorageSync(key)
      //console.log("myLocalRecord",myLocalRecord[0])
      await self.onQuery(Number(key), myLocalRecord[1], myLocalRecord[0]) //time,longitude,latitude
    }
    console.log("Success in QueryBulk", self.data.myZscanResult.length) 
  },

  async onQuery(ti,lo,la) {
    async: false
    let self =  this
    const db = wx.cloud.database()
    const dbcmd = db.command
    var myZscanResult = self.data.myZscanResult
    var myZcount = self.data.myZcount
    console.log("Scanning cloud database for local record: ",ti,lo,la)

    await db.collection('z_reports').where({
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
      success: res => {
        //Save scan results from cloud to local cache
        for(var item of res.data){
          var tmp = {}
          //tmp.title = String(item.ZTimeSlotUTC)
          tmp.title = new Date(item.ZTimeSlotUTC).toLocaleDateString()
          tmp.longitude = item.location.longitude
          tmp.latitude = item.location.latitude
          tmp.iconPath = '../../images/location.png'
          myZscanResult.push(tmp) //Caution: need to use HASH here but so hard to find out how
        }
        myZcount = myZcount + myZscanResult.length
        self.setData({
          myZcount: myZcount,
          myZscanResult: myZscanResult
        })
        console.log('[数据库] [查询记录] 成功: ', myZscanResult.length)
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
    console.log("Success in Query")
  },

  async onQuery5km(lo, la) {
    async: false
    let self = this
    const db = wx.cloud.database()
    const dbcmd = db.command
    var Z5kmVirusCount
    console.log("Scanning cloud database for local record 5km: ", lo, la)

    await db.collection('z_reports').where({
      _openid: this.data.openid,
      location: dbcmd.geoNear({
        geometry: db.Geo.Point(lo, la),
        minDistance: 0,
        maxDistance: 5000, //[设置][距离条件] Records in 5km meters distance 
      }),
    }).limit(20) //小程序限制每次最多取 20 条记录
       //.skip(20) //跳过多少条用于分页显示控制
      .get({
      success: res => {
        if (res.data.length = 20) { Z5kmVirusCount="大于19"}
        else { Z5kmVirusCount = res.data.length}
        self.setData({
          Z5kmVirusCount: Z5kmVirusCount
        })
        console.log('[数据库] [查询记录5km] 成功: ', self.data.Z5kmVirusCount)
        console.log('[数据库] [查询记录5km] 成功: ', res)
      },
        fail: err => {
          wx.showToast({
            icon: 'none',
            title: '查询记录失败5km'
          })
          console.error('[数据库] [查询记录5km] 失败：', err)
        }
      })
      //.count() //geo不让用count 真是 疼
    console.log('[数据库] [查询记录5km] 结束: ', self.data.Z5kmVirusCount)
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
