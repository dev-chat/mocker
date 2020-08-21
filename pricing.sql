UPDATE item SET price=pricePct*(
SELECT AVG(middle_values) AS 'median' FROM (
  SELECT t1.rep AS 'middle_values' FROM
    (
      SELECT @row:=@row+1 as `row`, x.rep
      FROM rep AS x, (SELECT @row:=0) AS r
      WHERE 1
      ORDER BY x.rep
    ) AS t1,
    (
      SELECT COUNT(*) as 'count'
      FROM rep x
      WHERE 1
    ) AS t2
    -- the following condition will return 1 record for odd number sets, or 2 records for even number sets.
    WHERE t1.row >= t2.count/2 and t1.row <= ((t2.count/2) +1)) AS t3
);