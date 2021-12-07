SELECT a.count, a.channel
  FROM (
  SELECT x.count as count, x.channel as channel 
    FROM (
      SELECT DATE_FORMAT(createdAt, "%w") as day, 
      DATE_FORMAT(FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP (createdAt)/120)*120), "%k:%i") as time, 
      DATE_FORMAT(createdAt, "%Y-%c-%e") as date,
      COUNT(*) as count,
      channel
      FROM activity
      WHERE eventType="message"
      GROUP BY day,time,date, channel
      ) as x 
      WHERE x.time="21:12" AND x.date="2021-12-7"
    ) as a
      CROSS JOIN
      (
      SELECT z.avg as avg, z.channel as channel
      FROM
      (
        SELECT AVG(y.count) as avg, y.channel as channel
        FROM (
          SELECT DATE_FORMAT(createdAt, "%w") as day,
          DATE_FORMAT(FROM_UNIXTIME(FLOOR(UNIX_TIMESTAMP (createdAt)/120)*120), "%k:%i") as time,
          DATE_FORMAT(createdAt, "%Y-%c-%e") as date,
          COUNT(*) as count,
          channel
          FROM activity
          WHERE eventType="message"
          GROUP BY day,time,date, channel
          ) as y
        WHERE y.day="2" AND y.time="21:12" AND y.date!="2021-12-7"
        GROUP BY channel
      ) as z
      ) as b
      WHERE a.count > b.avg 
      GROUP BY a.channel, a.count
      ORDER BY a.count DESC;
