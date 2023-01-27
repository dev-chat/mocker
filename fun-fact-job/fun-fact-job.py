import datetime
import mysql.connector
import os
import requests
import random
import ssl
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from urllib3 import Retry

urls = [
  { "url": "https://uselessfacts.jsph.pl/random.json?language=en", "fieldName": "text" },
  { "url": "https://api.api-ninjas.com/v1/facts?limit=1", "fieldName": "fact", "headers": { "X-Api-Key": "{ninjaApiKey}".format(ninjaApiKey=os.environ["API_NINJA_KEY"])}}
  ]

quotes = [
  { "url": "https://quotes.rest/qod.json?category=inspire" }
]
ssl._create_default_https_context = ssl._create_unverified_context

session = requests.session()
retry = Retry(
  total=5,
  backoff_factor=10
)

adapter = requests.adapters.HTTPAdapter(max_retries=retry)
session.mount('http://', adapter)
session.mount('https://', adapter)

def getFacts(ctx):
  facts = []
  
  while(len(facts) < 5):
    fact = getFact()
    if isNewFact(fact["fact"], fact["source"], ctx):
      addIdToDb(fact["fact"], fact["source"], ctx)
      facts.append(fact)

  return facts

def getQuote():
  url = random.choice(quotes)
  quote = session.get(url["url"])
  if (quote.ok):
    asJson = quote.json()
    return { 
      "text": "{quote} - {author}".format(quote=asJson["contents"]["quotes"][0]["quote"], author=asJson["contents"]["quotes"][0]["author"]),
      "image_url": "https://theysaidso.com/quote/image/{image_id}".format(image_id=asJson["contents"]["quotes"][0]["id"]) }
  else:
    return {
      "error": "Issue with quote API - non 200 status code"
    }

def getTrends():
  url = "https://api.twitter.com/1.1/trends/place.json?id=23424977"
  token = os.getenv("TWITTER_API_BEARER")
  trends = session.get(url, headers={ 'Authorization': 'Bearer {token}'.format(token=token)})
  if (trends):
    trendJson = trends.json()
    return trendJson[0]["trends"][0:5]
  else:
    raise Exception("Unable to get trends from Twitter")
  
def getOnThisDay():
  date = datetime.datetime.now()
  day = date.day
  month = date.month
  if (day <= 9):
    day = "0"+day
  if (month <= 9):
    month = "0"+month

  url="https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/{month}/{day}".format(month=month, day=day)
  onThisDay = session.get(url)
  if (onThisDay):
    onThisDayJson = onThisDay.json()
    otdRange = onThisDayJson["selected"][0:5]
    result = []
    for otd in otdRange:
      result.append({ "text": otd["text"], "url": otd["pages"][0]["content_urls"]["desktop"]["page"]})
    return result
  else:
    raise Exception("Unable to retrieve Wikipedia On This Day")

def getFact():
  url = random.choice(urls)
  if ("headers" in url):
    fact = session.get(url["url"], headers=url["headers"])
  else:
    fact = session.get(url["url"])
  
  if (fact):
    asJson = fact.json()
    if (isinstance(asJson, list)):
      return { "fact": asJson[0][url["fieldName"]], "source": url["url"]}
    else:
      return { "fact": asJson[url["fieldName"]], "source": url["url"] }
  else:
    raise Exception("Unable to retrieve fact")

def isNewFact(fact, source, ctx):
  mycursor = ctx.cursor(dictionary=True, buffered=True)
  mycursor.execute("SELECT fact FROM fact WHERE fact=%s AND source=%s;", (fact, source))
  dbFacts = mycursor.fetchall()
  return len(dbFacts) == 0

def addIdToDb(fact, source, ctx):
  mycursor = ctx.cursor(dictionary=True, buffered=True)
  mycursor.execute("INSERT INTO fact (fact, source) VALUES (%s, %s);", (fact, source))
  ctx.commit()

def sendSlackMessage(facts):
  quote = getQuote()
  trends = getTrends()
  onThisDay = getOnThisDay()
  blocks = createBlocks(quote, facts, trends, onThisDay)
  slack_token = os.environ["MUZZLE_BOT_TOKEN"]
  client = WebClient(token=slack_token)

  try:
      client.api_call(
        api_method='chat.postMessage',
        json={'channel': '#testbotz','blocks': blocks}
      )
    
  except SlackApiError as e:
      # You will get a SlackApiError if "ok" is False
      print(e)
      assert e.response["error"]

def createBlocks(quote, facts, trends, onThisDay):
  blocks = [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "SimpleTech's SimpleFacts :tm:",
        "emoji": True
      }
    }]
  if (quote and 'error' not in quote):
    blocks.append({
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": "*Inspirational Quote of the Day* \n"
          }
        ]
      })
    blocks.append({
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "{quote}".format(quote=quote["text"])
      }
    })
    blocks.append({
        "type": "divider"
      })
  
  blocks.append(
      {
        "type": "section",
        "fields": [
          {
            "type": "mrkdwn",
            "text": "*Daily Facts:*"
          }
        ]
      })
  
  factString = ""
  for fact in facts:
    factString = factString + "• {fact}\n".format(fact=fact["fact"])

  blocks.append(
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "{fact}".format(fact=factString)
      }
    })

  blocks.append({
        "type": "divider"
      })

  trendString = ""

  for trend in trends:
    trendString = trendString + "<{url}|{topic}>\n".format(url=trend["url"], topic=trend["name"])
  
  blocks.append(
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Daily Trends:*"
        }
      ]
    })

  blocks.append(
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "{trendString}".format(trendString=trendString)
        }
      ]
    })

  blocks.append({
    "type": "divider"
  })

  otdString = ""

  for otd in onThisDay:
    otdString = otdString + "{text} <{url}|Learn More>\n".format(text=otd["text"], url=otd["url"])
  
  blocks.append(
    {
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*On This Day:*"
        }
      ]
    })

  blocks.append({
    "type": "section",
    "fields": [
      {
        "type": "mrkdwn",
        "text": "{otdString}".format(otdString=otdString)
      }
    ]
  })

  blocks.append({
    "type": "divider"
  })

  blocks.append(
    {
        "type": "context",
        "elements": [
          {
            "type": "mrkdwn",
            "text": "Disclaimer: SimpleTech's SimpleFacts :tm: offer no guarantee to the validity of the facts provided."
          }
        ]
    }
  )

  
  return blocks

def main():
  try:
    cnx = mysql.connector.connect(
        host="localhost",
        user=os.getenv('TYPEORM_USERNAME'),
        password=os.getenv('TYPEORM_PASSWORD'),
        database='fun_fact',
        auth_plugin='mysql_native_password'
      )
  except mysql.connector.Error as err:
    if err.errno == mysql.connector.errorcode.ER_ACCESS_DENIED_ERROR:
      raise Exception("Something is wrong with your user name or password")
    elif err.errno == mysql.connector.errorcode.ER_BAD_DB_ERROR:
      raise Exception("Database does not exist")
    else:
      raise Exception(err)
  


  facts = getFacts(cnx)
  sendSlackMessage(facts)


main()