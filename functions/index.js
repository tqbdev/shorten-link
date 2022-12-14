const axios = require('axios');
const functions = require('firebase-functions');

const admin = require('firebase-admin');

const app = admin.initializeApp();
const db = admin.firestore();
db.settings({timestampsInSnapshots: true});

const logger = functions.logger;

const config = functions.config().config;
const apiKey = process.env.API_KEY || config.api_key || app.options_.apiKey;
const firebaseDynamicLinkApi = `https://firebasedynamiclinks.googleapis.com/v1/shortLinks?key=${apiKey}`;
const domainUriPrefix = config.domain_uri_prefix;
const URL_COLLECTION = config.url_collection || 'urls';

exports.shortUrl = functions.https.onRequest(async (req, res) => {
  const link = req.query.url || req.body.url || null;
  logger.info(JSON.stringify(req.headers, null, 4));

  try {
    logger.info(`Getting shorten URL for: ${link}`);
    const result = await axios.post(firebaseDynamicLinkApi, {
      dynamicLinkInfo: {
        domainUriPrefix,
        link,
      },
      suffix: {
        option: 'SHORT',
      },
    });

    // Store the result to Firestore
    try {
      const data = Object.assign(result.data, {
        clientInformation: req.headers,
        originalUrl: link,
        created: new Date(),
      });
      const shortenKey = data.shortLink.split('/').slice(-1).pop();
      const docRef = await db
          .collection(URL_COLLECTION)
          .doc(shortenKey)
          .set(data);
      logger.info('Document written with ID: ', docRef.id);
    } catch (error) {
      logger.error('Error adding document: ', error);
    }

    res.json(result.data);
  } catch (e) {
    logger.error(e.message);
    res.status(500).json('error');
  }
});

exports.analytics = functions.https.onRequest(async (req, res) => {
  // eslint-disable-next-line max-len
  const shortDynamicLink = req.query.shortLink || req.body.shortLink || null;
  // eslint-disable-next-line max-len
  const durationDays = req.query.durationDays || req.body.durationDays || 30;
  const requestUrl = `https://firebasedynamiclinks.googleapis.com/v1/${shortDynamicLink}/linkStats?durationDays=${durationDays}&key=${apiKey}`;

  try {
    logger.log(`Getting statistics for: ${shortDynamicLink}`);
    const result = await axios.get(requestUrl);
    res.json(result.data);
  } catch (e) {
    logger.error(e.message);
    res.status(500).json('error');
  }
});
