import mysql.connector
import os
import requests
import random
import ssl
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from urllib3 import Retry

ssl._create_default_https_context = ssl._create_unverified_context

session = requests.session()
retry = Retry(
  total=5,
  backoff_factor=10
)

adapter = requests.adapters.HTTPAdapter(max_retries=retry)
session.mount('http://', adapter)
session.mount('https://', adapter)

def getHealth():
  url = "https://muzzle.lol:3000/health"
  health = session.get(url)
  if (health.ok == False):
    raise Exception("Health check failed")

def sendSlackMessage(facts, joke, quote, onThisDay):
  slack_token = os.environ["MUZZLE_BOT_TOKEN"]
  client = WebClient(token=slack_token)

  try:
      client.api_call(
        api_method='chat.postMessage',
        json={'channel': '#general','blocks': blocks}
      )
    
  except SlackApiError as e:
      # You will get a SlackApiError if "ok" is False
      print(e)
      assert e.response["error"]

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
  blocks = createBlocks(quote, facts)
  slack_token = os.environ["MUZZLE_BOT_TOKEN"]
  client = WebClient(token=slack_token)

  try:
      client.api_call(
        api_method='chat.postMessage',
        json={'channel': '#general','blocks': blocks}
      )
    
  except SlackApiError as e:
      # You will get a SlackApiError if "ok" is False
      print(e)
      assert e.response["error"]

def createBlocks(quote, facts):
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
    print(quote)
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
            "text": "*Today's Facts:*"
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