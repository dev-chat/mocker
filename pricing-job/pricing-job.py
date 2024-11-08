import mysql.connector
import os
import time
import math

print("Beginning pricing job...")
start = time.time()
try:
  print("Connecting to mysql DB...")
  cnx = mydb = mysql.connector.connect(
      host="localhost",
      user=os.getenv('TYPEORM_USERNAME'),
      password=os.getenv('TYPEORM_PASSWORD'),
      database=os.getenv('TYPEORM_DATABASE'),
      auth_plugin='mysql_native_password'
    )
except mysql.connector.Error as err:
  if err.errno == errorcode.ER_ACCESS_DENIED_ERROR:
    print("Something is wrong with your user name or password")
  elif err.errno == errorcode.ER_BAD_DB_ERROR:
    print("Database does not exist")
  else:
    print(err)

print("Connected!")
mycursor = cnx.cursor(dictionary=True, buffered=True)

print('Retrieving distinct teams...')
mycursor.execute("SELECT DISTINCT(teamId) FROM slack_user;")

teams = mycursor.fetchall()
print('Teams retrieved!')
print('Retrieving all items...')
mycursor.execute("SELECT id, pricePct from item;")
print('Items retrieved!')

items = mycursor.fetchall()

for team in teams:
  # get total earned rep by team per user.
  totalEarnedRepQuery= """SELECT SUM(value) as sum, affectedUser FROM reaction GROUP BY affectedUser ORDER BY sum DESC;"""
  mycursor.execute(totalEarnedRepQuery)
  totalEarnedRep = mycursor.fetchall()
  #get total spent rep by team per user
  totalSpentRepQuery = """SELECT SUM(price) as sum, user FROM purchase GROUP BY user ORDER BY sum DESC;"""
  mycursor.execute(totalSpentRepQuery)
  totalRepSpent = mycursor.fetchall()
  repMap = {}
  for totalRep in totalEarnedRep:
    repMap[totalRep['affectedUser']] = totalRep['sum']
  for totalSpent in totalRepSpent:
    repMap[totalSpent['user']] = repMap[totalSpent['user']] - totalSpent['sum']
  repMap = {key: val for key, val in sorted(repMap.items(), key = lambda ele: ele[1], reverse = True)}
  medianIdx = math.floor((len(repMap) + 1 ) / 2)
  repList = list(repMap.items())
  medianRep = repList[medianIdx][1]
  for item in items:
    item_id = item['id']
    team_id= team['teamId']
    price = float(medianRep) * item['pricePct']
    item_query="INSERT INTO price(itemId, teamId, price, itemIdId) VALUES({item_id}, '{team_id}', {price}, {item_id});".format(item_id=item_id, team_id=team_id, price=price)
    mycursor.execute(item_query)
    cnx.commit()
  print("Completed update for {team}".format(team=team['teamId']))

print("Completed job in {time} seconds!".format(time=time.time() - start))
