import mysql.connector
import os
import requests
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
import ssl
import random

ssl._create_default_https_context = ssl._create_unverified_context
urls = [
  { "url": "https://uselessfacts.jsph.pl/random.json?language=en", "fieldName": "text" },
  { "url": "https://api.api-ninjas.com/v1/facts?limit=1", "fieldName": "fact", "headers": { "X-Api-Key": "{ninjaApiKey}".format(ninjaApiKey=os.environ["API_NINJA_KEY"])}},
  { "url": "https://catfact.ninja/fact", "fieldName": "fact" }
  ]

def getFacts(ctx):
  facts = []
  
  while(len(facts) < 5):
    fact = getFact()
    if isNewFact(fact["fact"], fact["source"], ctx):
      addIdToDb(fact["fact"], fact["source"], ctx)
      facts.append(fact)

  return facts

def getFact():
  url = random.choice(urls)
  if ("headers" in url):
    fact = requests.get(url["url"], headers=url["headers"])
  else:
    fact = requests.get(url["url"])
  
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

def formatString(facts):
  message = "*JR's Fun Facts*\n"
  for fact in facts:
    message = message + "- {fact}\n".format(fact=fact["fact"])
  print(message)
  return message

def sendSlackMessage(facts):
  message = formatString(facts)
  slack_token = os.environ["MUZZLE_BOT_TOKEN"]
  client = WebClient(token=slack_token)

  try:
      response = client.api_call(
        api_method='chat.postMessage',
        json={'channel': '#general','text': message}
      )
    
  except SlackApiError as e:
      # You will get a SlackApiError if "ok" is False
      print(e)
      assert e.response["error"]

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