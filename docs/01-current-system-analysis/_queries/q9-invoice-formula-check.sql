SET NOCOUNT ON;
WITH d AS (
 SELECT d.new_invoicdetailid, i.new_invoicenumber inv, p.new_contracttype ct,
  ISNULL(d.new_monthdays,0) md, ISNULL(d.new_workingdays,0) wd, ISNULL(d.new_mawariddays,0) fd,
  ISNULL(d.new_totalsalary,0) sal, ISNULL(d.new_salesprice,0) price,
  ISNULL(d.new_duesalary,0) duesal, ISNULL(d.new_dueamount,0) duefee, ISNULL(d.new_absencedeductions,0) absamt,
  ISNULL(d.new_abscentdays,0) absd, ISNULL(d.new_overtime,0) ot, ISNULL(d.new_othercommission,0) othpay,
  ISNULL(d.new_otherdeduction,0) othded, ISNULL(d.new_customerloan,0) custloan, ISNULL(d.new_loanamount,0) loan,
  ISNULL(d.new_internaldeduction,0) intded, ISNULL(d.new_internaladdition,0) intadd, ISNULL(d.new_gossifees,0) gossi,
  ISNULL(d.new_othermawaridearning,0) othcost, ISNULL(d.new_nettoemployee,0) net, ISNULL(d.new_totalwithoutvat,0) amt,
  ISNULL(d.new_vatamount,0) vat, ISNULL(d.new_totalwithvat,0) tot
 FROM new_invoicdetail d JOIN new_invoice i ON i.new_invoiceid=d.new_invoiceid JOIN new_project p ON p.new_projectid=i.new_projectid
 WHERE i.createdon>='2026-06-01' AND i.statuscode<>279640007 AND p.new_name<>'HeadOffice')
SELECT TOP 0 1 x;
SELECT COUNT(*) n,
 SUM(CASE WHEN ABS(amt-(duesal+othpay+ot-othded-custloan-absamt+duefee+othcost+gossi))<0.05 THEN 1 ELSE 0 END) amt_formula_ok,
 SUM(CASE WHEN ABS(net-(duesal+othpay+ot-othded-custloan-absamt-loan-intded+intadd))<0.05 THEN 1 ELSE 0 END) net_formula_ok,
 SUM(CASE WHEN md>0 AND ABS(duesal-ROUND(wd/md*sal,2))<0.05 THEN 1 ELSE 0 END) duesal_ok,
 SUM(CASE WHEN md>0 AND ABS(duefee-ROUND(ABS(fd/md*(price-sal)),2))<0.05 THEN 1 ELSE 0 END) duefee_ok,
 SUM(CASE WHEN ABS(vat-ROUND(amt*0.15,2))<0.05 THEN 1 ELSE 0 END) vat15_ok,
 SUM(CASE WHEN wd<>fd THEN 1 ELSE 0 END) wd_ne_fd,
 SUM(CASE WHEN loan<>0 OR intded<>0 THEN 1 ELSE 0 END) with_loan_or_intded,
 SUM(CASE WHEN absd>0 THEN 1 ELSE 0 END) with_absence,
 SUM(CASE WHEN gossi<>0 THEN 1 ELSE 0 END) with_gossi,
 SUM(CASE WHEN md=30 THEN 1 ELSE 0 END) md30
FROM d;
