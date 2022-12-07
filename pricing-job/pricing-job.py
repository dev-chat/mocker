import mysql.connector
import os
import time
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
print('Not implemented! Unable to get updated pricing because this logic needs to be revisited.')
for team in teams:
  # get total earned rep by team per user.
  totalEarnedRepQuery= """SELECT SUM(value) as sum, affectedUser FROM reaction GROUP BY affectedUser ORDER BY sum DESC;"""
  mycursor.execute(totalEarnedRepQuery)
  totalEarnedRep = mycursor.fetchall()
  totalSpentRepQuery = """SELECT SUM(price) as sum, user FROM purchase GROUP BY affectedUser ORDER BY sum DESC;"""
  totalRepSpent = mycursor.fetchall()
  repMap = {}
  for totalRep in totalEarnedRep:
    repMap[totalRep['affectedUser']] = totalRep['sum']
  print(repMap)
  print(totalRepSpent)
  for totalSpent in totalRepSpent:
    repMap[totalSpent['user']] = repMap[totalSpent['user']] - totalSpent['sum']
  print(repMap)

# for team in teams:
#   # get total earned rep by team
#   # get total spent rep by team
#   # get total available rep by math of above
#     query = """SELECT AVG(middle_values) AS 'median' FROM (
#   SELECT t1.rep AS 'middle_values' FROM
#     (
#       SELECT @row:=@row+1 as `row`, x.rep
#       FROM rep AS x, (SELECT @row:=0) AS r
#       WHERE teamId='{team}'
#       ORDER BY x.rep
#     ) AS t1,
#     (
#       SELECT COUNT(*) as 'count'
#       FROM rep x
#       WHERE teamId='{team}'
#     ) AS t2
#     WHERE t1.row >= t2.count/2 and t1.row <= ((t2.count/2) +1)) AS t3;""".format(team=team['teamId'])
#     mycursor.execute(query)
#     median = mycursor.fetchall()[0]['median']
#     print("Median for {team} is {median}".format(team=team['teamId'], median=median))
#     print("Updating items...")
#     for item in items:
#         item_id = item['id']
#         team_id= team['teamId']
#         price = float(median) * item['pricePct']
#         item_query="INSERT INTO price(itemId, teamId, price, itemIdId) VALUES({item_id}, '{team_id}', {price}, {item_id});".format(item_id=item_id, team_id=team_id, price=price)
#         mycursor.execute(item_query)
#         cnx.commit()
#     print("Completed update for {team}".format(team=team['teamId']))

print("Completed job in {time} seconds!".format(time=time.time() - start))
