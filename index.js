const admin = require("firebase-admin")
const functions = require("firebase-functions")

const region = 'asia-northeast1'
const channelSecret = ''
const channelAccessToken = ''

admin.initializeApp()

exports.LINEwebhook = functions.region(region).https.onRequest(async(request, response) => {
   console.log('🚀 Start Webhook!!', request.body )
   
   // Verify Signature
   const verify = await verify_signature(request, response)
   if(!verify) {
      response.status(200).send('Unauthorized').end()
      return
   }

   // Verify Events request must array
   const events = request.body.events
   if(!events || !Array.isArray(events)) {
      response.status(200).send('not have events').end()
      return
   }

   // Handle events
   events.forEach(async(event) => {
      if (event.type === 'videoPlayComplete') {
         await savePointVideoComplete(event)
      }
      console.log(event)
   })
   response.status(200).send("success").end()
   return
});

const savePointVideoComplete = async(event) => {
   const replyToken = event.replyToken
   let messages = ''
   const pointExists = await checkPointExists(event)
   if (pointExists) {
      messages = [{ 'type': 'text', 'text': '🎉 ขอบคุณที่รับชมวีดีโอ คุณเคยได้รับคะแนนกิจกรรมนี้ไปแล้ว 🎉' }]
   } else {
      await collectPoint(event)
      messages = [{ 'type': 'text', 'text': '🎉 ขอบคุณที่รับชมวีดีโอ รับคะแนนไปเลย 10 คะแนน 🎉' }]
   }
   await reply(replyToken, messages)
   return true
}

const collectPoint = async(event) => {
   try {
      const userId = event.source.userId
      const trackingId = event.videoPlayComplete.trackingId
      const timestamp = event.timestamp
      const params = {
         userId, trackingId, timestamp
      }
      await admin.firestore().collection('collectPoint').add(params)
      return true
  } catch (error) {
      console.error(error)
      return false
  }
}

const checkPointExists = async(event) => {
   try {
      const userId = event.source.userId
      const trackingId = event.videoPlayComplete.trackingId
      const data = await admin.firestore()
            .collection('collectPoint')
            .where('userId', '==', userId)
            .where('trackingId', '==', trackingId)
            .get()
      return !data.empty
  } catch (error) {
      console.error(error)
      return false
  }
}

const reply = async(replyToken, messages) => {
   const axios = require("axios")
   const data = { replyToken, messages }
   const headers = {
      'Authorization': `Bearer ${channelAccessToken}`,
      'Content-Type': 'application/json'
   }
   axios.post('https://api.line.me/v2/bot/message/reply', data, {
      headers: headers
   })
   .catch((error) => {
      console.log(error)
   })
}

const verify_signature = (req, res) => {
   const crypto = require('crypto')
   const text = JSON.stringify(req.body)
   const signature = crypto.createHmac('SHA256', channelSecret).update(text).digest('base64').toString()
   if (signature !== req.headers['x-line-signature']) {
       console.log('🧨Attack!!', text)
       return false
   } else {
      return true
   }
}
