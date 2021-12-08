import mysql.connector
import os
import requests
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

def getFacts(ctx):
  facts = []
  
  while(len(facts) < 5):
    fact = getFact()
    if isNewFact(fact["id"], fact["source"], ctx):
      addIdToDb(fact["id"], fact["source"], ctx)
      facts.append(fact)

  return facts

def getFact():
  url = "https://uselessfacts.jsph.pl/random.json?language=en"
  fact = requests.get(url)
  if (fact):
    asJson = fact.json()
    print(asJson)
    return { "text": asJson['text'], "id": asJson['id'], "source": url }
  else:
    raise Exception("Unable to retrieve fact")

def isNewFact(id, source, ctx):
  mycursor = ctx.cursor(dictionary=True, buffered=True)
  query = "SELECT id FROM fact WHERE id='{id}' AND source='{source}';".format(id=id, source=source)
  mycursor.execute(query)
  dbFacts = mycursor.fetchall()
  return len(dbFacts) == 0

def addIdToDb(id, source, ctx):
  mycursor = ctx.cursor(dictionary=True, buffered=True)
  query = "INSERT INTO fact (id, source) VALUES ('{id}', '{source}');".format(id=id, source=source)
  mycursor.execute(query)

def formatString(facts):
  message = "JR's Fun Facts\n"
  for fact in facts:
    message = message + "- {fact}\n".format(fact=fact["text"])
  print(message)

def sendSlackMessage(facts):
  message = formatString(facts)
  slack_token = os.environ["MUZZLE_BOT_TOKEN"]
  client = WebClient(token=slack_token)

  try:
      response = client.chat_postMessage(
          channel="#testbotz",
          text=message
      )
  except SlackApiError as e:
      # You will get a SlackApiError if "ok" is False
      assert e.response["error"]

def main():
  try:
    cnx = mysql.connector.connect(
        host="localhost",
        user=os.getenv('TYPEORM_USERNAME'),
        password=os.getenv('TYPEORM_PASSWORD'),
        database='fun_fact'
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